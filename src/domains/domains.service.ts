import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindManyOptions } from 'typeorm';
import { Domain } from './entities/domain.entity';
import { CreateDomainDto } from './dto/create-domain.dto';
import { UpdateDomainDto } from './dto/update-domain.dto';

@Injectable()
export class DomainsService {
  constructor(
    @InjectRepository(Domain)
    private readonly domainRepo: Repository<Domain>,
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
   */
  async update(id: number, dto: UpdateDomainDto): Promise<Domain> {
    // Validate domain exists
    const domain = await this.findOne(id);
    
    // If name is being changed, validate new name is unique
    if (dto.name && dto.name !== domain.name) {
      await this.validateDomainNameUnique(dto.name);
    }
    
    Object.assign(domain, dto);
    return this.domainRepo.save(domain);
  }

  /**
   * Deletes a domain (hard delete)
   * Note: Cascades to related modules due to FK constraint
   * @throws NotFoundException if domain doesn't exist
   */
  async remove(id: number): Promise<void> {
    const result = await this.domainRepo.delete(id);
    
    if (result.affected === 0) {
      throw new NotFoundException(`Domain with ID ${id} not found`);
    }
  }

  // ----------------------------------------------------------------------------
  // 2. QUERY OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Finds all domains with optional search filter
   * Returns domains sorted by name in ascending order
   * @param search - Optional search term to filter domain names (case-insensitive)
   */
  async findAll(search?: string): Promise<Domain[]> {
    const options: FindManyOptions<Domain> = {
      select: {
        id: true,
        name: true
      },
      order: { name: 'ASC' }
    };
    
    if (search) {
      options.where = { name: ILike(`%${search}%`) };
    }
    
    return this.domainRepo.find(options);
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  // ----------------------------------------------------------------------------
  // Validation Helpers
  // ----------------------------------------------------------------------------

  /**
   * Validates that a domain name is unique
   * @throws BadRequestException if domain name already exists
   */
  private async validateDomainNameUnique(name: string): Promise<void> {
    const existing = await this.domainRepo.findOne({ where: { name } });
    
    if (existing) {
      throw new BadRequestException(`Domain with name "${name}" already exists`);
    }
  }
}
