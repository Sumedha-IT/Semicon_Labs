import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Module } from './entities/module.entity';
import { DomainModule } from './entities/domain-module.entity';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ModuleQueryDto } from './dto/module-query.dto';
import { Domain } from '../domains/entities/domain.entity';

@Injectable()
export class ModulesService {
  constructor(
    @InjectRepository(Module)
    private moduleRepository: Repository<Module>,
    @InjectRepository(DomainModule)
    private domainModuleRepository: Repository<DomainModule>,
    @InjectRepository(Domain)
    private domainRepository: Repository<Domain>,
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
   * Finds a single module by ID with its domains
   */
  async findOne(id: number) {
    // Use entity objects with relations
    const module = await this.moduleRepository.findOne({
      where: { id },
      relations: {
        domainModules: {
          domain: true,
        },
      },
    });

    if (!module) {
      throw new NotFoundException(`Module with ID ${id} not found`);
    }

    // Map domains from relations
    const domains = module.domainModules.map((dm) => ({
      id: dm.domain.id,
      name: dm.domain.name,
      description: dm.domain.description,
    }));

    return {
      id: module.id,
      title: module.title,
      skills: module.skills,
      desc: module.desc,
      duration: module.duration,
      level: module.level,
      threshold_score: module.threshold_score,
      created_on: module.created_on,
      updated_on: module.updated_on,
      domains: domains,
    };
  }

  /**
   * Updates a module's information (title, desc, duration, level, skills)
   * Domain associations should be updated via linkDomains/unlinkDomain methods
   */
  async update(id: number, updateModuleDto: UpdateModuleDto) {
    const module = await this.validateModuleExists(id);

    // Check if title is being updated and if it conflicts with existing module
    if (updateModuleDto.title && updateModuleDto.title !== module.title) {
      const existingModule = await this.moduleRepository.findOne({
        where: { title: updateModuleDto.title },
      });

      if (existingModule && existingModule.id !== id) {
        throw new ConflictException(
          `Module with title "${updateModuleDto.title}" already exists`,
        );
      }
    }

    Object.assign(module, updateModuleDto);
    await this.moduleRepository.save(module);

    // Return module with domain info
    return this.findOne(id);
  }

  /**
   * Deletes a module (hard delete with cascade to user_modules)
   */
  async remove(id: number): Promise<void> {
    const module = await this.validateModuleExists(id);
    await this.moduleRepository.remove(module);
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
      domain_id,
      level,
      sort_by = 'created_on',
      sort_order = 'DESC',
    } = queryDto;

    // Validate domain exists if domain_id is specified
    if (domain_id !== undefined && domain_id !== null) {
      await this.validateDomainExists(domain_id);
    }

    const queryBuilder = this.moduleRepository
      .createQueryBuilder('m')
      .leftJoin('domain_modules', 'dm', 'dm.module_id = m.id')
      .leftJoin('domains', 'd', 'd.id = dm.domain_id');

    // Apply filters
    if (search) {
      queryBuilder.where('m.title ILIKE :search OR m.desc ILIKE :search', {
        search: `%${search}%`,
      });
    }

    if (domain_id) {
      queryBuilder.andWhere('dm.domain_id = :domain_id', { domain_id });
    }

    if (level) {
      queryBuilder.andWhere('m.level = :level', { level });
    }

    // Get count before grouping
    const totalQuery = queryBuilder.clone();
    const totalResult = await totalQuery
      .select('COUNT(DISTINCT m.id)', 'total')
      .getRawOne();
    const total = parseInt(totalResult?.total || 0);

    // Get modules with domains
    queryBuilder
      .select([
        'm.id AS id',
        'm.title AS title',
        'm.desc AS description',
        'm.duration AS duration',
        'm.level AS level',
        'm.threshold_score AS threshold_score',
        'm.created_on AS created_on',
        `STRING_AGG(DISTINCT d.name, ', ' ORDER BY d.name) AS domain_names`,
        `ARRAY_AGG(DISTINCT d.id) FILTER (WHERE d.id IS NOT NULL) AS domain_ids`,
      ])
      .groupBy(
        'm.id, m.title, m.desc, m.duration, m.level, m.threshold_score, m.created_on',
      )
      .orderBy(`m.${sort_by}`, sort_order as 'ASC' | 'DESC')
      .offset((page - 1) * limit)
      .limit(limit);

    const modules = await queryBuilder.getRawMany();

    return {
      data: modules,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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

  // ----------------------------------------------------------------------------
  // Module-Domain Linking Operations
  // ----------------------------------------------------------------------------

  /**
   * Link module to additional domains
   */
  async linkDomains(moduleId: number, domainIds: number[]) {
    await this.validateModuleExists(moduleId);

    const invalidDomains = await this.validateDomainsExist(domainIds);
    if (invalidDomains.length > 0) {
      throw new BadRequestException(
        `Domains not found: ${invalidDomains.join(', ')}`,
      );
    }

    //Get existing links
    const existing = await this.domainModuleRepository.find({
      where: { module_id: moduleId },
    });
    const existingDomainIds = existing.map((dm) => dm.domain_id);

    // Filter out already linked domains
    const newDomainIds = domainIds.filter(
      (id) => !existingDomainIds.includes(id),
    );

    if (newDomainIds.length === 0) {
      return {
        message: 'All specified domains are already linked to this module',
        linked: [],
        skipped: domainIds,
      };
    }

    const domainLinks = newDomainIds.map((domainId) =>
      this.domainModuleRepository.create({
        module_id: moduleId,
        domain_id: domainId,
      }),
    );
    await this.domainModuleRepository.save(domainLinks);

    return {
      message: `Linked module to ${newDomainIds.length} new domain(s)`,
      linked: newDomainIds,
      skipped: domainIds.filter((id) => existingDomainIds.includes(id)),
    };
  }

  /**
   * Unlink module from a domain
   */
  async unlinkDomain(moduleId: number, domainId: number) {
    await this.validateModuleExists(moduleId);
    await this.validateDomainExists(domainId);

    const result = await this.domainModuleRepository.delete({
      module_id: moduleId,
      domain_id: domainId,
    });

    if (result.affected === 0) {
      throw new NotFoundException(
        `Module ${moduleId} is not linked to domain ${domainId}`,
      );
    }

    return {
      message: `Successfully unlinked module ${moduleId} from domain ${domainId}`,
    };
  }

  /**
   * Get all domains linked to a module
   */
  async getModuleDomains(moduleId: number) {
    // Use entity objects with relations
    const module = await this.moduleRepository.findOne({
      where: { id: moduleId },
      relations: {
        domainModules: {
          domain: true,
        },
      },
    });

    if (!module) {
      throw new NotFoundException(`Module with ID ${moduleId} not found`);
    }

    // Map domains from relations
    return module.domainModules.map((dm) => ({
      id: dm.domain.id,
      name: dm.domain.name,
      description: dm.domain.description,
    }));
  }
}
