import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Module } from './entities/module.entity';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ModuleQueryDto } from './dto/module-query.dto';
import { Domain } from '../domains/entities/domain.entity';

@Injectable()
export class ModulesService {
  constructor(
    @InjectRepository(Module)
    private moduleRepository: Repository<Module>,
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
   * Creates a new module
   * Validates domain exists and title uniqueness within the domain
   */
  async create(createModuleDto: CreateModuleDto) {
    // Validate domain exists
    await this.validateDomainExists(createModuleDto.domainId);

    // Check if module with same title already exists in the same domain
    const existingModule = await this.moduleRepository.findOne({
      where: { 
        title: createModuleDto.title,
        domainId: createModuleDto.domainId
      }
    });
  
    if (existingModule) {
      throw new ConflictException(
        `Module with title "${createModuleDto.title}" already exists in domain ${createModuleDto.domainId}`
      );
    }

    const module = this.moduleRepository.create(createModuleDto);
    const saved = await this.moduleRepository.save(module);
    
    return this.mapToResponse(saved);
  }

  /**
   * Finds a single module by ID
   */
  async findOne(id: number) {
    const module = await this.moduleRepository.findOne({
      where: { id },
      select: {
        id: true,
        title: true,
        desc: true,
        domainId: true
      }
    });

    if (!module) {
      throw new NotFoundException(`Module with ID ${id} not found`);
    }

    return this.mapToResponse(module);
  }

  /**
   * Updates a module's information
   * Validates domain exists (if changed) and title uniqueness
   */
  async update(id: number, updateModuleDto: UpdateModuleDto) {
    const module = await this.validateModuleExists(id);

    // If domain is being changed, validate new domain exists
    if (updateModuleDto.domainId && updateModuleDto.domainId !== module.domainId) {
      await this.validateDomainExists(updateModuleDto.domainId);
    }
    
    // Check if title is being updated and if it conflicts with existing module in the same domain
    if (updateModuleDto.title && updateModuleDto.title !== module.title) {
      const targetDomainId = updateModuleDto.domainId ?? module.domainId;
      const existingModule = await this.moduleRepository.findOne({
        where: { 
          title: updateModuleDto.title,
          domainId: targetDomainId
        }
      });

      if (existingModule && existingModule.id !== id) {
        throw new ConflictException(
          `Module with title "${updateModuleDto.title}" already exists in domain ${targetDomainId}`
        );
      }
    }

    Object.assign(module, updateModuleDto);
    const updated = await this.moduleRepository.save(module);
    
    return this.mapToResponse(updated);
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
      sort_order = 'DESC' 
    } = queryDto;
    
    // Validate domain exists if domain_id is specified
    if (domain_id !== undefined && domain_id !== null) {
      await this.validateDomainExists(domain_id);
    }
    
    const queryBuilder = this.moduleRepository.createQueryBuilder('module');

    // Select fields
    const selectFields = ['module.id', 'module.title', 'module.desc', 'module.domainId'];
    
    // Add sort field to select if it's not already included
    if (sort_by && !selectFields.includes(`module.${sort_by}`)) {
      selectFields.push(`module.${sort_by}`);
    }
    
    queryBuilder.select(selectFields);

    // Apply filters
    if (search) {
      queryBuilder.where(
        'module.title ILIKE :search OR module.desc ILIKE :search', 
        { search: `%${search}%` }
      );
    }

    if (domain_id) {
      queryBuilder.andWhere('module.domainId = :domain_id', { domain_id });
    }

    if (level) {
      queryBuilder.andWhere('module.level = :level', { level });
    }

    // Apply sorting and pagination
    queryBuilder
      .orderBy(`module.${sort_by}`, sort_order as 'ASC' | 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [modules, total] = await queryBuilder.getManyAndCount();

    return {
      data: modules.map(module => this.mapToResponse(module)),
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
      where: { id }
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
      where: { id: domainId }
    });

    if (!domain) {
      throw new NotFoundException(`Domain with ID ${domainId} not found`);
    }
  }

  // ----------------------------------------------------------------------------
  // Response Mapping Helpers
  // ----------------------------------------------------------------------------

  /**
   * Maps a module entity to a response object
   * Returns only necessary fields: id, title, desc, domainId
   */
  private mapToResponse(module: Module): { id: number; title: string; desc: string; domainId: number } {
    return {
      id: module.id,
      title: module.title,
      desc: module.desc,
      domainId: module.domainId
    };
  }
}
