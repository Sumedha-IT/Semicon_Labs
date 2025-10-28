import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { UserDomain } from './entities/user-domain.entity';
import { Domain } from '../domains/entities/domain.entity';
import { User } from '../users/entities/user.entity';
import { UserModule } from '../user-modules/entities/user-module.entity';
import { UserDomainQueryDto } from './dto/user-domain.dto';
import { QueryBuilderHelper } from '../common/utils/query-builder.helper';

@Injectable()
export class UserDomainsService {
  constructor(
    @InjectRepository(UserDomain)
    private readonly repo: Repository<UserDomain>,
    @InjectRepository(Domain)
    private readonly domainRepo: Repository<Domain>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserModule)
    private readonly userModuleRepo: Repository<UserModule>,
  ) {}

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  // ----------------------------------------------------------------------------
  // 1. LINK/UNLINK OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Links a user to multiple domains
   * Validates user and domains exist, handles duplicates and existing links
   * @returns Object with linked, skipped, invalid domain IDs
   */
  async link(
    userId: number,
    domainIds: number[],
  ): Promise<{
    linked: number[];
    skipped: number[];
    invalid: number[];
    duplicates?: number[];
  }> {
    // Validate user exists
    await this.validateUserExists(userId);

    // Remove duplicates and track them
    const uniqueDomainIds = [...new Set(domainIds)];
    const duplicates =
      domainIds.length !== uniqueDomainIds.length
        ? domainIds.filter((id, index) => domainIds.indexOf(id) !== index)
        : [];

    // Validate which domains exist
    const validDomains = await this.domainRepo.find({
      where: uniqueDomainIds.map((id) => ({ id })),
    });

    const validDomainIds = validDomains.map((domain) => domain.id);
    const invalidDomainIds = uniqueDomainIds.filter(
      (id) => !validDomainIds.includes(id),
    );

    // If no valid domains, return early
    if (validDomainIds.length === 0) {
      return {
        linked: [],
        skipped: [],
        invalid: invalidDomainIds,
        ...(duplicates.length > 0 && { duplicates }),
      };
    }

    // Check which valid domains are already linked
    const existingLinks = await this.repo.find({
      where: validDomainIds.map((domainId) => ({
        user_id: userId,
        domain_id: domainId,
      })),
    });

    const existingDomainIds = existingLinks.map((link) => link.domain_id);
    const newDomainIds = validDomainIds.filter(
      (id) => !existingDomainIds.includes(id),
    );

    // If no new domains to link, return early
    if (newDomainIds.length === 0) {
      return {
        linked: [],
        skipped: existingDomainIds,
        invalid: invalidDomainIds,
        ...(duplicates.length > 0 && { duplicates }),
      };
    }

    // Insert new domain links using insert with orIgnore
    const values = newDomainIds.map((id) => ({
      user_id: userId,
      domain_id: id,
    }));
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(UserDomain)
      .values(values)
      .orIgnore()
      .execute();

    return {
      linked: newDomainIds,
      skipped: existingDomainIds,
      invalid: invalidDomainIds,
      ...(duplicates.length > 0 && { duplicates }),
    };
  }


  // ----------------------------------------------------------------------------
  // 2. QUERY OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Lists all domains assigned to a user with pagination, search, and sorting
   * Returns paginated domain fields including timestamps
   */
  async listUserDomains(userId: number, queryDto: UserDomainQueryDto) {
    // Validate user exists
    await this.validateUserExists(userId);

    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'name',
      sortOrder = 'asc',
    } = queryDto;

    // Build query with join to domain
    const queryBuilder = this.repo
      .createQueryBuilder('ud')
      .innerJoinAndSelect('ud.domain', 'd')
      .where('ud.user_id = :userId', { userId });

    // Apply search filter on domain fields
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
      sortOrder.toUpperCase() as 'ASC' | 'DESC',
      'name',
    );

    // Apply pagination
    const result = await QueryBuilderHelper.paginate(queryBuilder, page, limit);

    // Transform the data to return domain fields
    return {
      ...result,
      data: result.data.map((ud: UserDomain) => ({
        id: ud.domain.id,
        name: ud.domain.name,
        description: ud.domain.description ?? null,
        created_on: ud.domain.created_on,
        updated_on: ud.domain.updated_on,
      })),
    };
  }

  /**
   * Gets a specific domain assigned to a user
   * Returns domain details if the user-domain relationship exists
   */
  async getUserDomain(userId: number, domainId: number) {
    // Validate user exists
    await this.validateUserExists(userId);

    // Find the user-domain relationship with domain details
    const userDomain = await this.repo
      .createQueryBuilder('ud')
      .innerJoinAndSelect('ud.domain', 'd')
      .where('ud.user_id = :userId', { userId })
      .andWhere('ud.domain_id = :domainId', { domainId })
      .getOne();

    if (!userDomain) {
      throw new NotFoundException(
        `Domain with ID ${domainId} is not linked to user ${userId}`,
      );
    }

    // Return domain details
    return {
      id: userDomain.domain.id,
      name: userDomain.domain.name,
      description: userDomain.domain.description ?? null,
      created_on: userDomain.domain.created_on,
      updated_on: userDomain.domain.updated_on,
      linked_on: userDomain.created_on,
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  // ----------------------------------------------------------------------------
  // Validation Helpers
  // ----------------------------------------------------------------------------

  /**
   * Validates that a user exists and is active
   * @throws NotFoundException if user doesn't exist or is deleted
   */
  private async validateUserExists(userId: number): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: userId, deleted_on: IsNull() },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
  }

  /**
   * Validates that a domain exists
   * @throws NotFoundException if domain doesn't exist
   */
  private async validateDomainExists(domainId: number): Promise<void> {
    const domain = await this.domainRepo.findOne({ where: { id: domainId } });

    if (!domain) {
      throw new NotFoundException(`Domain with ID ${domainId} not found`);
    }
  }

  /**
   * Gets all modules for a specific user with pagination and filtering
   */
  async getUserModules(userId: number, queryDto: any) {
    const {
      page = 1,
      limit = 10,
      status,
      domainId,
      enroll,
    } = queryDto;

    // Validate user exists
    const user = await this.userRepo.findOne({
      where: { id: userId, deleted_on: IsNull() },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (enroll === 'false') {
      // Handle enroll=false - find modules available to user but not enrolled in
      return this.getAvailableModulesForUser(userId, { page, limit, domainId });
    }

    // Handle enroll=true or undefined - get enrolled modules
    // Build query to get user modules through user_domains and domain_modules
    const queryBuilder = this.userModuleRepo
      .createQueryBuilder('um')
      .innerJoinAndSelect('um.userDomain', 'ud')
      .innerJoinAndSelect('ud.domain', 'd')
      .innerJoinAndSelect('um.module', 'm')
      .where('ud.user_id = :userId', { userId });

    // Apply filters
    if (status) {
      queryBuilder.andWhere('um.status = :status', { status });
    }

    if (domainId) {
      queryBuilder.andWhere('ud.domain_id = :domainId', { domainId });
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder
      .orderBy('um.joined_on', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const enrollments = await queryBuilder.getMany();

    // Map to response format
    const data = enrollments.map((enrollment) => ({
      id: enrollment.id,
      module_id: enrollment.module_id,
      module_title: enrollment.module.title,
      module_description: enrollment.module.desc,
      module_duration: enrollment.module.duration,
      module_level: enrollment.module.level,
      domain_id: enrollment.userDomain.domain_id,
      domain_name: enrollment.userDomain.domain.name,
      status: enrollment.status,
      score: enrollment.score,
      threshold_score: enrollment.threshold_score,
      questions_answered: enrollment.questions_answered,
      joined_on: enrollment.joined_on,
      completed_on: enrollment.completed_on,
      passed: enrollment.score >= enrollment.threshold_score,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Gets modules available to user but not enrolled in
   */
  private async getAvailableModulesForUser(userId: number, queryDto: any) {
    const { page = 1, limit = 10, domainId } = queryDto;

    // Find modules available to the user through their domains but not enrolled in
    const queryBuilder = this.userModuleRepo
      .createQueryBuilder('um')
      .innerJoin('um.userDomain', 'ud')
      .innerJoin('ud.domain', 'd')
      .innerJoin('domain_modules', 'dm', 'dm.domain_id = ud.domain_id')
      .innerJoin('modules', 'm', 'm.id = dm.module_id')
      .leftJoin('user_modules', 'um2', 'um2.user_domain_id = ud.id AND um2.module_id = dm.module_id')
      .where('ud.user_id = :userId', { userId })
      .andWhere('um2.id IS NULL') // Not enrolled in this module
      .select([
        'm.id as module_id',
        'm.title as module_title',
        'm.desc as module_description',
        'm.duration as module_duration',
        'm.level as module_level',
        'ud.domain_id as domain_id',
        'd.name as domain_name'
      ]);

    if (domainId) {
      queryBuilder.andWhere('ud.domain_id = :domainId', { domainId });
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder
      .orderBy('m.title', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const results = await queryBuilder.getRawMany();

    // Map to response format
    const data = results.map((result) => ({
      id: null, // No enrollment ID since not enrolled
      module_id: result.module_id,
      module_title: result.module_title,
      module_description: result.module_description,
      module_duration: result.module_duration,
      module_level: result.module_level,
      domain_id: result.domain_id,
      domain_name: result.domain_name,
      status: 'available', // Available for enrollment
      score: null,
      threshold_score: null,
      questions_answered: null,
      joined_on: null,
      completed_on: null,
      passed: null,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Validates that both user and domain exist
   * @throws NotFoundException with combined error message if either doesn't exist
   */
  private async validateUserAndDomainExist(
    userId: number,
    domainId: number,
  ): Promise<void> {
    // Check both in parallel for better performance
    const [user, domain] = await Promise.all([
      this.userRepo.findOne({
        where: { id: userId, deleted_on: IsNull() },
      }),
      this.domainRepo.findOne({ where: { id: domainId } }),
    ]);

    // Build comprehensive error message
    const errors: string[] = [];

    if (!user) {
      errors.push(`User with ID ${userId} not found`);
    }

    if (!domain) {
      errors.push(`Domain with ID ${domainId} not found`);
    }

    // If either resource doesn't exist, throw error with all details
    if (errors.length > 0) {
      throw new NotFoundException(errors.join('. '));
    }
  }
}
