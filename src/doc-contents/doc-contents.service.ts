import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import AdmZip = require('adm-zip');
import { DocContent } from './entities/doc-content.entity';
import { Topic } from '../topics/entities/topic.entity';
import { CreateDocContentDto } from './dto/create-doc-content.dto';
import { UpdateDocContentDto } from './dto/update-doc-content.dto';
import { DocContentQueryDto } from './dto/doc-content-query.dto';
import { ZipValidator } from './utils/zip-validator.util';
import { HtmlSanitizer } from './utils/html-sanitizer.util';
import { FileStorageService } from './utils/file-storage.util';
import { ChangelogService } from '../changelog/changelog.service';
import { QueryBuilderHelper } from '../common/utils/query-builder.helper';

@Injectable()
export class DocContentsService {
  constructor(
    @InjectRepository(DocContent)
    private readonly docContentRepo: Repository<DocContent>,
    @InjectRepository(Topic)
    private readonly topicRepo: Repository<Topic>,
    private readonly fileStorageService: FileStorageService,
    private readonly changelogService: ChangelogService,
  ) {}

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  // ----------------------------------------------------------------------------
  // 1. CORE CRUD OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Creates a new doc content with ZIP file upload
   * @param dto Create DTO
   * @param file Uploaded ZIP file
   * @param userId User who uploaded
   * @returns Created doc content
   */
  async create(
    dto: CreateDocContentDto,
    file: Express.Multer.File,
    userId: number,
  ): Promise<DocContent> {
    // Validate topic exists
    const topic = await this.topicRepo.findOne({
      where: { id: dto.topicId },
    });
    if (!topic) {
      throw new NotFoundException(`Topic with ID ${dto.topicId} not found`);
    }

    // Check if topic already has doc content (one-to-one)
    const existingDocContent = await this.docContentRepo.findOne({
      where: { topicId: dto.topicId },
    });
    if (existingDocContent) {
      throw new ConflictException(
        `Topic with ID ${dto.topicId} already has doc content`,
      );
    }

    // Validate ZIP file
    ZipValidator.validate(file.buffer);

    // Create doc content entity
    const docContent = this.docContentRepo.create({
      title: dto.title,
      topicId: dto.topicId,
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype,
      uploadedBy: userId,
      // Temporary values - will be updated after processing
      storageUrl: '',
      storageKeyPrefix: '',
    });

    // Save to get ID
    const savedDocContent = await this.docContentRepo.save(docContent);

    try {
      // Process ZIP and upload files
      await this.processZipBundle(file.buffer, savedDocContent.id);

      // Update with storage URLs
      savedDocContent.storageUrl =
        this.fileStorageService.getStorageFolder(savedDocContent.id);
      savedDocContent.storageKeyPrefix =
        this.fileStorageService.getStorageKeyPrefix(savedDocContent.id);

      await this.docContentRepo.save(savedDocContent);

      return savedDocContent;
    } catch (error) {
      // Rollback: delete record if processing failed
      await this.docContentRepo.remove(savedDocContent);
      throw error;
    }
  }

  /**
   * Finds a single doc content by ID
   * @param id Doc content ID
   * @returns Doc content
   */
  async findOne(id: number): Promise<DocContent> {
    const docContent = await this.docContentRepo.findOne({
      where: { id },
    });

    if (!docContent) {
      throw new NotFoundException(`DocContent with ID ${id} not found`);
    }

    return docContent;
  }

  /**
   * Finds doc content by topic ID
   * @param topicId Topic ID
   * @returns Doc content or null
   */
  async findByTopicId(topicId: number): Promise<DocContent | null> {
    const docContent = await this.docContentRepo.findOne({
      where: { topicId },
    });

    return docContent;
  }

  /**
   * Finds all doc contents with optional search filter
   * @param search Optional search term
   * @returns Array of doc contents
   */
  async findAll(search?: string): Promise<DocContent[]> {
    const options: any = {
      where: {},
      order: { title: 'ASC' },
    };

    if (search) {
      options.where = { title: ILike(`%${search}%`) };
    }

    return await this.docContentRepo.find(options);
  }

  /**
   * Finds doc contents with advanced filtering, pagination, and sorting
   * @param queryDto Query parameters
   * @returns Paginated result
   */
  async findWithFilters(queryDto: DocContentQueryDto) {
    const {
      search,
      topicId,
      page = 1,
      limit = 10,
      sortBy = 'title',
      sortOrder = 'ASC',
    } = queryDto;

    const queryBuilder = this.docContentRepo
      .createQueryBuilder('doc_content');

    // Apply filters
    QueryBuilderHelper.applySearch(
      queryBuilder,
      'doc_content',
      ['title'],
      search,
    );
    QueryBuilderHelper.applyEqualityFilter(
      queryBuilder,
      'doc_content',
      'topicId',
      topicId,
    );

    // Apply sorting
    const columnMap: Record<string, string> = {
      title: 'title',
      createdOn: 'created_on',
      updatedOn: 'updated_on',
    };
    QueryBuilderHelper.applySorting(
      queryBuilder,
      'doc_content',
      columnMap,
      sortBy,
      sortOrder,
      'title',
    );

    // Apply pagination
    const result = await QueryBuilderHelper.paginate(queryBuilder, page, limit);

    return result;
  }

  /**
   * Updates doc content (metadata and/or files)
   * @param id Doc content ID
   * @param dto Update DTO
   * @param file Optional new ZIP file
   * @param userId User who updated
   * @returns Updated doc content
   */
  async update(
    id: number,
    dto: UpdateDocContentDto,
    file: Express.Multer.File | undefined,
    userId: number,
  ): Promise<DocContent> {
    const docContent = await this.findOne(id);

    // Extract reason for changelog
    const { reason, ...updateData } = dto;

    // If file is provided, replace the bundle
    if (file) {
      // Validate new ZIP file
      ZipValidator.validate(file.buffer);

      // Delete old files
      await this.fileStorageService.deleteFolder(docContent.storageKeyPrefix);

      // Process new ZIP
      await this.processZipBundle(file.buffer, id);

      // Update file metadata
      docContent.fileName = file.originalname;
      docContent.fileSize = file.size;
      docContent.fileType = file.mimetype;
    }

    // Merge metadata updates (if any)
    Object.assign(docContent, updateData);

    // Save updated doc content
    await this.docContentRepo.save(docContent);

    // Create changelog entry
    const changeReason = file
      ? reason || 'File bundle replaced'
      : reason || 'Metadata updated';

    await this.changelogService.createLog({
      changeType: 'doc_content',
      changeTypeId: id,
      userId: userId,
      reason: changeReason,
    });

    return docContent;
  }

  /**
   * Gets the view URL for a doc content
   * @param id Doc content ID
   * @returns View URL object
   */
  async getViewUrl(id: number): Promise<{ url: string }> {
    const docContent = await this.findOne(id);

    const url = this.fileStorageService.getIndexFileUrl(docContent.id);

    return { url };
  }

  // ----------------------------------------------------------------------------
  // 2. PRIVATE HELPER METHODS
  // ----------------------------------------------------------------------------

  /**
   * Processes a ZIP bundle: extracts, validates, and uploads files
   * @param buffer ZIP file buffer
   * @param docContentId Doc content ID
   */
  private async processZipBundle(
    buffer: Buffer,
    docContentId: number,
  ): Promise<void> {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const fileContent = entry.getData();
      const fileName = entry.entryName;

      // Validate HTML files for dangerous patterns
      HtmlSanitizer.validateFile(fileContent, fileName);

      // Upload file to storage
      const key = `${docContentId}/${fileName}`;
      await this.fileStorageService.uploadFile(key, fileContent);
    }
  }
}

