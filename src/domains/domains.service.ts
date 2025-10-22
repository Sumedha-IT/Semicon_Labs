import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Domain } from './entities/domain.entity';
import { CreateDomainDto } from './dto/create-domain.dto';
import { UpdateDomainDto } from './dto/update-domain.dto';
import { DomainQueryDto } from './dto/domain-query.dto';
import { ChangelogService } from '../changelog/changelog.service';
import { QueryBuilderHelper } from '../common/utils/query-builder.helper';

@Injectable()
export class DomainsService {
  constructor(
    @InjectRepository(Domain)
    private readonly domainRepo: Repository<Domain>,
    private readonly changelogService: ChangelogService,
  ) {}

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  // ----------------------------------------------------------------------------
  // 1. CORE CRUD OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Creates a new domain
   * Validates domain name uniqueness before creation
   */
  async create(dto: CreateDomainDto): Promise<Domain> {
    // Validate domain name is unique
    await this.validateDomainNameUnique(dto.name);

    const domain = this.domainRepo.create(dto);
    return this.domainRepo.save(domain);
  }

  /**
   * Finds a single domain by ID
   * @throws NotFoundException if domain doesn't exist
   */
  async findOne(id: number): Promise<Domain> {
    const domain = await this.domainRepo.findOne({ where: { id } });

    if (!domain) {
      throw new NotFoundException(`Domain with ID ${id} not found`);
    }

    return domain;
  }

  /**
   * Updates a domain's information
   * Validates name uniqueness if name is being changed
   * Creates a changelog entry after successful update
   */
  async update(id: number, dto: UpdateDomainDto, userId: number): Promise<Domain> {
    // Validate domain exists
    const domain = await this.findOne(id);

    // Extract reason for changelog (don't save it in domain)
    const { reason, ...domainData } = dto;

    // If name is being changed, validate new name is unique
    if (domainData.name && domainData.name !== domain.name) {
      await this.validateDomainNameUnique(domainData.name);
    }

    Object.assign(domain, domainData);
    const updatedDomain = await this.domainRepo.save(domain);

    // Create changelog entry
    await this.changelogService.createLog({
      changeType: 'domain',
      changeTypeId: id,
      userId: userId,
      reason,
    });

    return updatedDomain;
  }

  // ----------------------------------------------------------------------------
  // 2. QUERY OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Finds all domains with pagination, search, and sorting
   */
  async findAll(queryDto: DomainQueryDto) {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'name',
      sortOrder = 'ASC',
    } = queryDto;

    const queryBuilder = this.domainRepo.createQueryBuilder('d');

    // Apply search filter using QueryBuilderHelper
    if (search) {
      QueryBuilderHelper.applySearch(queryBuilder, 'd', ['name', 'description'], search);
    }

    // Map camelCase to database column names
    const columnMap: Record<string, string> = {
      name: 'name',
      createdOn: 'created_on',
    };

    // Apply sorting
    QueryBuilderHelper.applySorting(
      queryBuilder,
      'd',
      columnMap,
      sortBy,
      sortOrder,
      'name',
    );

    // Apply pagination
    const result = await QueryBuilderHelper.paginate(queryBuilder, page, limit);

    return result;
  }

  // Domain-module operations moved to DomainModulesService for clean architecture

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  // ----------------------------------------------------------------------------
  // Validation Helpers
  // ----------------------------------------------------------------------------

  /**
   * Validates that a domain name is unique (case-insensitive)
   * @throws ConflictException if domain name already exists
   */
  private async validateDomainNameUnique(name: string): Promise<void> {
    const existing = await this.domainRepo.findOne({ 
      where: { name: ILike(name) } 
    });

    if (existing) {
      throw new ConflictException(
        `Domain with name "${name}" already exists (case-insensitive)`,
      );
    }
  }
}
