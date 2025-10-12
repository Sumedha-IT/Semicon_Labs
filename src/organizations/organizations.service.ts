import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, SelectQueryBuilder } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { User } from '../users/entities/user.entity';
import { OrganizationQueryDto } from './dto/organization-query.dto';
import { PaginatedResponseDto, PaginationMetaDto } from '../users/dto/paginated-response.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private organizationsRepository: Repository<Organization>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  // ----------------------------------------------------------------------------
  // 1. CORE CRUD OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Creates a new organization
   * Validates uniqueness of name, POC email, and POC phone
   */
  async create(createOrganizationDto: CreateOrganizationDto): Promise<Organization> {
    // Validate organization name uniqueness
    await this.validateUniqueField('name', createOrganizationDto.name);
    
    // Validate POC email uniqueness if provided
    if (createOrganizationDto.poc_email) {
      await this.validateUniqueField('poc_email', createOrganizationDto.poc_email);
    }
    
    // Validate POC phone uniqueness if provided
    if (createOrganizationDto.poc_phone) {
      await this.validateUniqueField('poc_phone', createOrganizationDto.poc_phone);
    }
    
    const organization = this.organizationsRepository.create(createOrganizationDto);
    return this.organizationsRepository.save(organization);
  }

  /**
   * Finds a single organization by ID (only non-deleted)
   */
  async findOne(id: number): Promise<Organization | null> {
    return this.organizationsRepository.findOne({
      where: { org_id: id, deleted_on: IsNull() },
    });
  }

  /**
   * Finds all non-deleted organizations
   */
  async findAll(): Promise<Organization[]> {
    return this.organizationsRepository.find({
      where: { deleted_on: IsNull() },
    });
  }

  /**
   * Updates an organization's information
   * Validates uniqueness constraints for updated fields
   */
  async update(id: number, updateOrganizationDto: UpdateOrganizationDto): Promise<Organization | null> {
    // Check if organization exists
    const existingOrg = await this.findOne(id);
    if (!existingOrg) {
      throw new BadRequestException('Organization not found');
    }

    // Validate uniqueness constraints for updated fields
    await this.validateOrganizationUpdate(id, updateOrganizationDto);
    
    await this.organizationsRepository.update(id, updateOrganizationDto);
    return this.findOne(id);
  }

  /**
   * Soft deletes an organization
   * Prevents deletion if organization has active users
   */
  async remove(id: number): Promise<{ success: boolean; message: string }> {
    const organization = await this.findOne(id);
    if (!organization) {
      return this.createErrorResponse('Organization not found');
    }

    // Check if organization is already soft deleted
    if (organization.deleted_on) {
      return this.createErrorResponse('Organization is already deleted');
    }

    // Check if organization has active users
    const userCount = await this.getUserCount(id);
    
    if (userCount > 0) {
      // Get detailed user breakdown for better error message
      const userCountByRole = await this.getUserCountByRole(id);
      const userBreakdown = Object.entries(userCountByRole)
        .map(([role, count]) => `${count} ${role}(s)`)
        .join(', ');
      
      return this.createErrorResponse(
        `Cannot delete organization. It has ${userCount} active user(s): ${userBreakdown}.`
      );
    }

    // Perform soft delete
    await this.organizationsRepository.update(id, { 
      deleted_on: new Date(),
      updated_on: new Date()
    });

    return this.createSuccessResponse('Organization soft deleted successfully');
  }

  // ----------------------------------------------------------------------------
  // 2. QUERY OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Advanced organization search with pagination and filtering
   * Supports multiple filters: type, industry, location, subscription, dates, search
   * ClientAdmin restricted to their organization
   */
  async findOrganizationsWithPagination(
    queryDto: OrganizationQueryDto,
    requestingUser: any
  ): Promise<PaginatedResponseDto<Organization>> {
    const qb = this.organizationsRepository
      .createQueryBuilder('org')
      .select(['org.org_id', 'org.name'])
      .where('org.deleted_on IS NULL');

    // ClientAdmin can only see their org
    if (requestingUser?.role === 'ClientAdmin' && requestingUser?.orgId != null) {
      qb.andWhere('org.org_id = :orgId', { orgId: requestingUser.orgId });
    }

    // Apply filters
    this.applyFilters(qb, queryDto);
    
    // Apply sorting
    this.applySorting(qb, queryDto);

    // Pagination
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 20;
    const skip = (page - 1) * limit;
    const total = await qb.getCount();
    qb.skip(skip).take(limit);
    const data = await qb.getMany();

    const pagination = new PaginationMetaDto(page, limit, total);
    const appliedFilters = this.createAppliedFiltersObject(queryDto);

    return new PaginatedResponseDto(data, pagination, appliedFilters);
  }

  // ----------------------------------------------------------------------------
  // 3. STATISTICS & USER COUNT OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Gets the count of active users in an organization
   */
  async getUserCount(orgId: number): Promise<number> {
    const count = await this.usersRepository.count({
      where: { 
        org_id: orgId, 
        deleted_on: IsNull() 
      }
    });
    return count;
  }

  /**
   * Gets the breakdown of users by role in an organization
   */
  async getUserCountByRole(orgId: number): Promise<{ [role: string]: number }> {
    const result = await this.usersRepository
      .createQueryBuilder('user')
      .select('user.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .where('user.org_id = :orgId', { orgId })
      .andWhere('user.deleted_on IS NULL')
      .groupBy('user.role')
      .getRawMany();
    
    return result.reduce((acc, row) => {
      acc[row.role] = parseInt(row.count);
      return acc;
    }, {});
  }

  /**
   * Gets comprehensive statistics for an organization
   * Includes organization details and user breakdown
   */
  async getOrganizationStatistics(id: number): Promise<any> {
    const organization = await this.findOne(id);
    if (!organization) {
      return null;
    }

    const userCount = await this.getUserCount(id);
    const userCountByRole = await this.getUserCountByRole(id);

    return {
      organization: {
        org_id: organization.org_id,
        name: organization.name,
        type: organization.type,
        industry: organization.industry,
        location: organization.location,
        created_on: organization.created_on
      },
      statistics: {
        total_users: userCount,
        users_by_role: userCountByRole
      }
    };
  }

  // ----------------------------------------------------------------------------
  // 4. VALIDATION OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Validates that an organization exists
   */
  async validateOrganizationExists(id: number): Promise<boolean> {
    const organization = await this.findOne(id);
    return organization !== null;
  }

  /**
   * Validates whether an organization can accept new users
   * Checks if organization exists and is not deleted
   */
  async validateOrganizationCanAcceptUsers(id: number): Promise<{ canAccept: boolean; reason?: string }> {
    const organization = await this.findOne(id);
    
    if (!organization) {
      return { canAccept: false, reason: 'Organization not found' };
    }

    if (organization.deleted_on) {
      return { canAccept: false, reason: 'Organization is deleted' };
    }

    // Add any other business rules here (e.g., subscription limits, etc.)
    return { canAccept: true };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  // ----------------------------------------------------------------------------
  // Response Helpers
  // ----------------------------------------------------------------------------

  /**
   * Creates a standardized error response
   */
  private createErrorResponse(message: string): { success: boolean; message: string } {
    return {
      success: false,
      message
    };
  }

  /**
   * Creates a standardized success response
   */
  private createSuccessResponse(message: string): { success: boolean; message: string } {
    return {
      success: true,
      message
    };
  }

  // ----------------------------------------------------------------------------
  // Validation Helpers
  // ----------------------------------------------------------------------------

  /**
   * Generic validation helper to check field uniqueness
   * @param field - The field name to validate (name, poc_email, poc_phone)
   * @param value - The value to check for uniqueness
   * @param excludeId - Optional organization ID to exclude from check (for updates)
   * @throws ConflictException if field value already exists
   */
  private async validateUniqueField(
    field: 'name' | 'poc_email' | 'poc_phone',
    value: string,
    excludeId?: number
  ): Promise<void> {
    // Normalize the value based on field type
    let normalizedValue = value.trim();
    if (field === 'poc_email') {
      normalizedValue = normalizedValue.toLowerCase();
    }

    const existingOrg = await this.organizationsRepository.findOne({
      where: { [field]: normalizedValue, deleted_on: IsNull() }
    });
    
    // If found and it's not the organization being updated
    if (existingOrg && (!excludeId || existingOrg.org_id !== excludeId)) {
      const fieldName = {
        name: 'name',
        poc_email: 'POC email',
        poc_phone: 'POC phone'
      }[field];
      
      throw new ConflictException(`Organization with this ${fieldName} already exists`);
    }
  }

  /**
   * Validates uniqueness constraints when updating an organization
   * Checks name, POC email, and POC phone if they are being updated
   */
  private async validateOrganizationUpdate(id: number, updateDto: UpdateOrganizationDto): Promise<void> {
    // Check if name is being updated and validate uniqueness
    if (updateDto.name) {
      await this.validateUniqueField('name', updateDto.name, id);
    }

    // Check if POC email is being updated and validate uniqueness
    if (updateDto.poc_email) {
      await this.validateUniqueField('poc_email', updateDto.poc_email, id);
    }

    // Check if POC phone is being updated and validate uniqueness
    if (updateDto.poc_phone) {
      await this.validateUniqueField('poc_phone', updateDto.poc_phone, id);
    }
  }

  // ----------------------------------------------------------------------------
  // Query Building Helpers (for findOrganizationsWithPagination)
  // ----------------------------------------------------------------------------

  /**
   * Applies filters to a query builder based on query DTO
   */
  private applyFilters(qb: SelectQueryBuilder<Organization>, queryDto: OrganizationQueryDto): void {
    // Type filter
    if (queryDto.type) {
      qb.andWhere('org.type = :type', { type: queryDto.type });
    }

    // Industry filter
    if (queryDto.industry) {
      qb.andWhere('org.industry = :industry', { industry: queryDto.industry });
    }

    // Location filter
    if (queryDto.location) {
      qb.andWhere('org.location LIKE :location', { location: `%${queryDto.location}%` });
    }

    // Subscription ID filter
    if (queryDto.subscriptionId != null) {
      qb.andWhere('org.subscription_id = :subscriptionId', { subscriptionId: queryDto.subscriptionId });
    }

    // Created date range filters
    if (queryDto.createdAfter || queryDto.createdBefore) {
      if (queryDto.createdAfter && queryDto.createdBefore) {
        qb.andWhere('org.created_on BETWEEN :ca AND :cb', { 
          ca: queryDto.createdAfter, 
          cb: queryDto.createdBefore 
        });
      } else if (queryDto.createdAfter) {
        qb.andWhere('org.created_on >= :ca', { ca: queryDto.createdAfter });
      } else if (queryDto.createdBefore) {
        qb.andWhere('org.created_on <= :cb', { cb: queryDto.createdBefore });
      }
    }

    // Updated date range filters
    if (queryDto.updatedAfter || queryDto.updatedBefore) {
      if (queryDto.updatedAfter && queryDto.updatedBefore) {
        qb.andWhere('org.updated_on BETWEEN :ua AND :ub', { 
          ua: queryDto.updatedAfter, 
          ub: queryDto.updatedBefore 
        });
      } else if (queryDto.updatedAfter) {
        qb.andWhere('org.updated_on >= :ua', { ua: queryDto.updatedAfter });
      } else if (queryDto.updatedBefore) {
        qb.andWhere('org.updated_on <= :ub', { ub: queryDto.updatedBefore });
      }
    }

    // Search filter (name, POC name, or POC email)
    if (queryDto.search) {
      qb.andWhere(
        '(org.name ILIKE :q OR org.poc_name ILIKE :q OR org.poc_email ILIKE :q)',
        { q: `%${queryDto.search}%` }
      );
    }
  }

  /**
   * Applies sorting to a query builder
   */
  private applySorting(qb: SelectQueryBuilder<Organization>, queryDto: OrganizationQueryDto): void {
    const sortBy = queryDto.sortBy || 'name';
    const sortOrder = (queryDto.sortOrder || 'asc').toUpperCase() as 'ASC' | 'DESC';
    
    const columnMap: Record<string, string> = {
      name: 'org.name',
      created_on: 'org.created_on',
      updated_on: 'org.updated_on',
      location: 'org.location',
      type: 'org.type',
    };
    
    qb.orderBy(columnMap[sortBy] || 'org.name', sortOrder);
  }

  /**
   * Creates an object containing all applied filters from query DTO
   */
  private createAppliedFiltersObject(queryDto: OrganizationQueryDto): Record<string, any> {
    const appliedFilters: Record<string, any> = {};
    
    if (queryDto.type) appliedFilters.type = queryDto.type;
    if (queryDto.industry) appliedFilters.industry = queryDto.industry;
    if (queryDto.location) appliedFilters.location = queryDto.location;
    if (queryDto.subscriptionId != null) appliedFilters.subscriptionId = queryDto.subscriptionId;
    if (queryDto.createdAfter) appliedFilters.createdAfter = queryDto.createdAfter;
    if (queryDto.createdBefore) appliedFilters.createdBefore = queryDto.createdBefore;
    if (queryDto.updatedAfter) appliedFilters.updatedAfter = queryDto.updatedAfter;
    if (queryDto.updatedBefore) appliedFilters.updatedBefore = queryDto.updatedBefore;
    if (queryDto.search) appliedFilters.search = queryDto.search;
    
    return appliedFilters;
  }
}
