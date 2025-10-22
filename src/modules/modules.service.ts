import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Module } from './entities/module.entity';
import { DomainModule } from '../domain-modules/entities/domain-module.entity';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ModuleQueryDto } from './dto/module-query.dto';
import { Domain } from '../domains/entities/domain.entity';
import { ChangelogService } from '../changelog/changelog.service';
import { QueryBuilderHelper } from '../common/utils/query-builder.helper';

@Injectable()
export class ModulesService {
  constructor(
    @InjectRepository(Module)
    private moduleRepository: Repository<Module>,
    @InjectRepository(DomainModule)
    private domainModuleRepository: Repository<DomainModule>,
    @InjectRepository(Domain)
    private domainRepository: Repository<Domain>,
    private readonly changelogService: ChangelogService,
  ) {}

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  // ----------------------------------------------------------------------------
  // 1. CORE CRUD OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Creates a new module and links it to multiple domains
   * Validates all domains exist
   */
  async create(createModuleDto: CreateModuleDto) {
    const { domainIds, ...moduleData } = createModuleDto;

    // Validate all domains exist
    const invalidDomains = await this.validateDomainsExist(domainIds);
    if (invalidDomains.length > 0) {
      throw new BadRequestException(
        `Domains not found: ${invalidDomains.join(', ')}`,
      );
    }

    // Check if module with same title already exists
    const existingModule = await this.moduleRepository.findOne({
      where: { title: createModuleDto.title },
    });

    if (existingModule) {
      throw new ConflictException(
        `Module with title "${createModuleDto.title}" already exists`,
      );
    }

    // Create the module
    const module = this.moduleRepository.create(moduleData);
    const saved = await this.moduleRepository.save(module);

    // Link module to domains
    const domainLinks = domainIds.map((domainId) =>
      this.domainModuleRepository.create({
        module_id: saved.id,
        domain_id: domainId,
      }),
    );
    await this.domainModuleRepository.save(domainLinks);

    // Return module with domain info
    return this.findOne(saved.id);
  }

  /**
   * Finds a single module by ID
   */
  async findOne(id: number) {
    const module = await this.moduleRepository.findOne({
      where: { id },
    });

    if (!module) {
      throw new NotFoundException(`Module with ID ${id} not found`);
    }

    return {
      id: module.id,
      title: module.title,
      desc: module.desc,
      duration: module.duration,
      level: module.level,
      created_on: module.created_on,
      updated_on: module.updated_on,
    };
  }

  /**
   * Updates a module's information (title, desc, duration, level, threshold_score)
   * Domain associations should be updated via linkDomains/unlinkDomain methods
   */
  async update(id: number, updateModuleDto: UpdateModuleDto, userId: number) {
    const module = await this.validateModuleExists(id);

    // Extract reason for changelog (don't save it in module)
    const { reason, ...moduleData } = updateModuleDto;

    // Check if title is being updated and if it conflicts with existing module
    if (moduleData.title && moduleData.title !== module.title) {
      const existingModule = await this.moduleRepository.findOne({
        where: { title: moduleData.title },
      });

      if (existingModule && existingModule.id !== id) {
        throw new ConflictException(
          `Module with title "${moduleData.title}" already exists`,
        );
      }
    }

    Object.assign(module, moduleData);
    await this.moduleRepository.save(module);

    // Create changelog entry
    await this.changelogService.createLog({
      changeType: 'module',
      changeTypeId: id,
      userId: userId,
      reason,
    });

    // Return module with domain info
    return this.findOne(id);
  }

  // ----------------------------------------------------------------------------
  // 2. QUERY OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Advanced module search with pagination and filtering
   * Supports filters: search (title/desc), domain_id, level, sorting
   */
  async findAll(queryDto: ModuleQueryDto) {
    const {
      page = 1,
      limit = 10,
      search,
      domainId,
      level,
      sortBy = 'createdOn',
      sortOrder = 'DESC',
    } = queryDto;

    // Validate domain exists if domainId is specified
    if (domainId !== undefined && domainId !== null) {
      await this.validateDomainExists(domainId);
    }

    const queryBuilder = this.moduleRepository
      .createQueryBuilder('m')
      .select([
        'm.id',
        'm.title',
        'm.desc',
        'm.duration',
        'm.level',
        'm.created_on',
      ]);

    // Apply filters using QueryBuilderHelper
    if (search) {
      QueryBuilderHelper.applySearch(queryBuilder, 'm', ['title', 'desc'], search);
    }

    if (domainId) {
      // Join only when filtering by domain
      queryBuilder
        .innerJoin('domain_modules', 'dm', 'dm.module_id = m.id')
        .andWhere('dm.domain_id = :domainId', { domainId });
    }

    QueryBuilderHelper.applyEqualityFilter(queryBuilder, 'm', 'level', level);

    // Apply sorting
    const columnMap: Record<string, string> = {
      title: 'title',
      createdOn: 'created_on',
      level: 'level',
      duration: 'duration',
    };
    QueryBuilderHelper.applySorting(
      queryBuilder,
      'm',
      columnMap,
      sortBy,
      sortOrder,
      'created_on',
    );

    // Apply pagination
    const result = await QueryBuilderHelper.paginate(queryBuilder, page, limit);

    return result;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  // ----------------------------------------------------------------------------
  // Validation Helpers
  // ----------------------------------------------------------------------------

  /**
   * Validates that a module exists
   * @throws NotFoundException if module doesn't exist
   */
  private async validateModuleExists(id: number): Promise<Module> {
    const module = await this.moduleRepository.findOne({
      where: { id },
    });

    if (!module) {
      throw new NotFoundException(`Module with ID ${id} not found`);
    }

    return module;
  }

  /**
   * Validates that a domain exists
   * @throws NotFoundException if domain doesn't exist
   */
  private async validateDomainExists(domainId: number): Promise<void> {
    const domain = await this.domainRepository.findOne({
      where: { id: domainId },
    });

    if (!domain) {
      throw new NotFoundException(`Domain with ID ${domainId} not found`);
    }
  }

  /**
   * Validates that multiple domains exist
   * @returns Array of invalid domain IDs
   */
  private async validateDomainsExist(domainIds: number[]): Promise<number[]> {
    const domains = await this.domainRepository
      .createQueryBuilder('d')
      .where('d.id IN (:...ids)', { ids: domainIds })
      .getMany();

    const validIds = domains.map((d) => d.id);
    const invalidIds = domainIds.filter((id) => !validIds.includes(id));

    return invalidIds;
  }

}
