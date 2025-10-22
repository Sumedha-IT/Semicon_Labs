import {
  Injectable,
  ConflictException,
  BadRequestException,
  UnprocessableEntityException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  IsNull,
  MoreThan,
  Like,
  Or,
  Between,
  SelectQueryBuilder,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateIndividualUserDto } from './dto/create-individual-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto, SortBy } from './dto/user-query.dto';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from './dto/paginated-response.dto';
import { UserDomainsService } from '../user-domains/user-domains.service';
import { UserModulesService } from '../user-modules/user-modules.service';
import { UserTopicsService } from '../user-topics/user-topics.service';
import { UserRole } from '../common/constants/user-roles';
import { Organization } from '../organizations/entities/organization.entity';
import { QueryBuilderHelper } from '../common/utils/query-builder.helper';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Organization)
    private organizationsRepository: Repository<Organization>,
    private readonly userDomainsService: UserDomainsService,
    @Inject(forwardRef(() => UserModulesService))
    private readonly userModulesService: UserModulesService,
    @Inject(forwardRef(() => UserTopicsService))
    private readonly userTopicsService: UserTopicsService,
  ) {}

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  // ----------------------------------------------------------------------------
  // 1. CORE CRUD OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Creates a new user (organization user or individual learner)
   * Validates email uniqueness, role restrictions, and organization requirements
   */
  async create(
    createUserDto: CreateUserDto | CreateIndividualUserDto,
  ): Promise<User> {
    try {
      // Check if user with this email already exists (including soft-deleted users)
      const existingUser = await this.usersRepository.findOne({
        where: { email: createUserDto.email },
      });
      if (existingUser) {
        if (existingUser.deleted_on) {
          throw new ConflictException(
            `User with email ${createUserDto.email} was previously deleted and cannot be recreated. Please use a different email address.`,
          );
        } else {
          throw new ConflictException(
            `User with email ${createUserDto.email} already exists`,
          );
        }
      }

      // Only validate manager/ClientAdmin/PlatformAdmin creation rules if role is present (CreateUserDto)
      if ('role' in createUserDto) {
        // Validate Platform Admin creation rules (only one Platform Admin allowed)
        await this.validatePlatformAdminCreation(
          createUserDto as CreateUserDto,
        );

        // Validate manager creation rules
        await this.validateManagerCreation(createUserDto as CreateUserDto);

        // Validate ClientAdmin creation rules
        await this.validateClientAdminCreation(createUserDto as CreateUserDto);
      }

      // Hash the password before saving
      const hashedPassword = await this.hashPassword(createUserDto.password);

      // Remove password field and add password_hash
      const { password, ...userDataWithoutPassword } = createUserDto;
      const userData = {
        ...userDataWithoutPassword,
        password_hash: hashedPassword,
        // Convert dob string to Date if present
        dob: userDataWithoutPassword.dob
          ? new Date(userDataWithoutPassword.dob)
          : undefined,
      };

      const user = this.usersRepository.create(userData);
      return await this.usersRepository.save(user);
    } catch (error) {
      // Log the error for debugging
      console.error('Error creating user:', error);
      throw error; // Re-throw to be handled by the global exception filter
    }
  }

  /**
   * Finds a single user by ID (only non-deleted users)
   */
  async findOne(id: number): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id: id, deleted_on: IsNull() },
    });
  }

  /**
   * Finds all non-deleted users (returns only user IDs)
   */
  async findAll(): Promise<{ id: number }[]> {
    const users = await this.usersRepository.find({
      where: { deleted_on: IsNull() },
      select: {
        id: true,
      },
    });
    return users.map((user) => ({ id: user.id }));
  }

  /**
   * Finds a user by email address (only non-deleted users)
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email, deleted_on: IsNull() },
    });
  }

  /**
   * Finds the Platform Admin user (only non-deleted)
   */
  async findPlatformAdmin(): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { role: UserRole.PLATFORM_ADMIN, deleted_on: IsNull() },
    });
  }

  /**
   * Updates a user's information
   * Validates email uniqueness and role change restrictions
   */
  async update(id: number, updateUserDto: UpdateUserDto): Promise<User | null> {
    // Check if user exists
    const existingUser = await this.findOne(id);
    if (!existingUser) {
      throw new BadRequestException('User not found');
    }

    // Check for duplicate email if email is being updated
    await this.validateEmailUniqueness(updateUserDto.email, existingUser.email);

    // Validate role changes
    if (updateUserDto.role) {
      await this.validateUserUpdate(id, updateUserDto);
    }

    // Prepare update data (hash password if provided)
    const updateData = await this.prepareUpdateData(updateUserDto);

    await this.usersRepository.update(id, updateData);
    return this.findOne(id);
  }

  /**
   * Soft deletes a user
   * Handles role-specific deletion rules (manager/ClientAdmin validation)
   * Cleans up user associations (domains, modules) before deletion
   */
  async remove(id: number): Promise<{ success: boolean; message: string }> {
    // First check if user exists at all (including soft deleted)
    const userAnyStatus = await this.usersRepository.findOne({
      where: { id: id },
    });

    if (!userAnyStatus) {
      return this.createErrorResponse('User not found');
    }

    // Check if user is already soft deleted
    if (userAnyStatus.deleted_on) {
      return this.createErrorResponse('User is already deleted');
    }

    // Get the active user for further processing
    const user = await this.findOne(id);

    if (!user) {
      return this.createErrorResponse('User not found');
    }

    let teamMembersCount = 0;
    let reassignmentMessage = '';

    // If deleting a manager, check if they have active learners
    if (user.role === 'Manager') {
      try {
        await this.validateManagerDeletion(id, user.org_id);
      } catch (error) {
        return this.createErrorResponse(error.message);
      }

      // Reassign any remaining team members to ClientAdmin
      teamMembersCount = await this.reassignManagerTeamMembers(id, user.org_id);
      reassignmentMessage =
        teamMembersCount > 0
          ? ` ${teamMembersCount} team members reassigned to ClientAdmin.`
          : '';
    }

    // If deleting a ClientAdmin, check if they have active managers or learners
    if (user.role === 'ClientAdmin') {
      try {
        await this.validateClientAdminDeletion(user.org_id);
      } catch (error) {
        return this.createErrorResponse(error.message);
      }
    }

    // Clean up user associations before soft delete
    await this.cleanupUserDomains(id);
    await this.cleanupUserTopics(id);
    await this.cleanupUserModules(id);

    // Soft delete the user using ORM
    await this.usersRepository.update(
      { id: id },
      {
        deleted_on: new Date(),
        updated_on: new Date(),
      },
    );

    return this.createSuccessResponse(
      `User soft deleted successfully.${reassignmentMessage}`,
    );
  }

  /**
   * Debug method to get detailed user information (including soft-deleted users)
   * Returns user status, domain associations, and basic user data
   */
  async debugUser(id: number): Promise<any> {
    // Check if user exists at all (including soft deleted)
    const userAnyStatus = await this.usersRepository.findOne({
      where: { id: id },
    });

    // Check if user exists and is not deleted
    const userActive = await this.findOne(id);

    // Check user domains - get all without pagination for validation
    const userDomainsResult = await this.userDomainsService
      .listUserDomains(id, { page: 1, limit: 1000 })
      .catch(() => ({ data: [] }));
    const userDomains = userDomainsResult.data || [];

    return {
      userId: id,
      userExists: !!userAnyStatus,
      userActive: !!userActive,
      userDeleted: userAnyStatus ? !!userAnyStatus.deleted_on : null,
      deletedOn: userAnyStatus?.deleted_on || null,
      userDomainsCount: userDomains.length,
      userDomains: userDomains,
      userData: userAnyStatus
        ? {
            name: userAnyStatus.name,
            email: userAnyStatus.email,
            role: userAnyStatus.role,
            org_id: userAnyStatus.org_id,
            deleted_on: userAnyStatus.deleted_on,
          }
        : null,
    };
  }

  // ----------------------------------------------------------------------------
  // 2. ORGANIZATION-SCOPED OPERATIONS (ClientAdmin & PlatformAdmin)
  // ----------------------------------------------------------------------------

  /**
   * Finds all users in a specific organization
   */
  async findByOrganization(orgId: number): Promise<User[]> {
    return this.usersRepository.find({
      where: { org_id: orgId, deleted_on: IsNull() },
      relations: this.getStandardRelations(),
    });
  }

  /**
   * Finds a specific user within an organization
   */
  async findOneInOrganization(id: number, orgId: number): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id: id, org_id: orgId, deleted_on: IsNull() },
      relations: this.getStandardRelations(),
    });
  }

  /**
   * Updates a user within an organization context
   */
  async updateInOrganization(
    id: number,
    orgId: number,
    updateUserDto: UpdateUserDto,
  ): Promise<User | null> {
    const user = await this.findOneInOrganization(id, orgId);
    if (!user) {
      return null;
    }

    // Check for duplicate email if email is being updated
    await this.validateEmailUniqueness(updateUserDto.email, user.email);

    // Validate role changes
    if (updateUserDto.role) {
      await this.validateUserUpdate(id, updateUserDto);
    }

    // Prepare update data (hash password if provided)
    const updateData = await this.prepareUpdateData(updateUserDto);

    await this.usersRepository.update(id, updateData);
    return this.findOneInOrganization(id, orgId);
  }

  /**
   * Soft deletes a user from an organization
   * Similar to remove() but scoped to organization
   */
  async removeFromOrganization(
    id: number,
    orgId: number,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.findOneInOrganization(id, orgId);
    if (!user) {
      return this.createErrorResponse('User not found in organization');
    }

    // Check if user is already soft deleted
    if (user.deleted_on) {
      return this.createErrorResponse('User is already deleted');
    }

    let teamMembersCount = 0;
    let reassignmentMessage = '';

    // If deleting a manager from organization, check if they have active learners
    if (user.role === 'Manager') {
      try {
        await this.validateManagerDeletion(id, orgId);
      } catch (error) {
        // Change error message for organization context
        const message = error.message.replace(
          'Cannot delete manager',
          'Cannot remove manager from organization',
        );
        return this.createErrorResponse(message);
      }

      // Reassign any remaining team members to ClientAdmin
      teamMembersCount = await this.reassignManagerTeamMembers(id, orgId);
      reassignmentMessage =
        teamMembersCount > 0
          ? ` ${teamMembersCount} team members reassigned to ClientAdmin.`
          : '';
    }

    // If removing a ClientAdmin from organization, check if they have active managers or learners
    if (user.role === 'ClientAdmin') {
      try {
        await this.validateClientAdminDeletion(orgId);
      } catch (error) {
        // Change error message for organization context
        const message = error.message.replace(
          'Cannot delete ClientAdmin',
          'Cannot remove ClientAdmin from organization',
        );
        return this.createErrorResponse(message);
      }
    }

    // Clean up user associations before soft delete
    await this.cleanupUserDomains(id, ` from organization ${orgId}`);
    await this.cleanupUserTopics(id, ` from organization ${orgId}`);
    await this.cleanupUserModules(id, ` from organization ${orgId}`);

    await this.usersRepository.update(id, {
      deleted_on: new Date(),
      updated_on: new Date(),
    });

    return this.createSuccessResponse(
      `User soft deleted from organization successfully.${reassignmentMessage}`,
    );
  }

  // ----------------------------------------------------------------------------
  // 3. MANAGER-SCOPED OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Finds all learners assigned to a specific manager
   */
  async findByManager(managerId: number): Promise<User[]> {
    return this.usersRepository.find({
      where: {
        manager_id: managerId,
        org_id: MoreThan(0), // Only organization learners
        deleted_on: IsNull(),
      },
      relations: this.getStandardRelations(),
    });
  }

  // ----------------------------------------------------------------------------
  // 4. SEARCH & QUERY OPERATIONS (PlatformAdmin & ClientAdmin with restrictions)
  // ----------------------------------------------------------------------------

  /**
   * Searches users by name or email
   * ClientAdmin can only search within their organization
   */
  async searchUsers(query: string, requestingUser: any): Promise<User[]> {
    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.organization', 'organization')
      .leftJoinAndSelect('user.manager', 'manager')
      .where('user.deleted_on IS NULL')
      .andWhere('(user.name LIKE :query OR user.email LIKE :query)', {
        query: `%${query}%`,
      });

    // ClientAdmin can only search within their organization
    if (requestingUser.role === 'ClientAdmin') {
      queryBuilder.andWhere('user.org_id = :orgId', {
        orgId: requestingUser.orgId,
      });
    }

    return queryBuilder.getMany();
  }

  /**
   * Filters users by role
   * ClientAdmin can only see users in their organization
   */
  async filterByRole(role: string, requestingUser: any): Promise<User[]> {
    const whereCondition = this.buildWhereCondition(requestingUser);
    whereCondition.role = role;

    return this.usersRepository.find({
      where: whereCondition,
      relations: this.getStandardRelations(),
    });
  }

  /**
   * Filters users by organization
   * ClientAdmin can only filter their own organization
   */
  async filterByOrganization(
    orgId: number,
    requestingUser: any,
  ): Promise<User[]> {
    // ClientAdmin can only filter their own organization
    if (this.checkClientAdminPermission(requestingUser, orgId)) {
      return [];
    }

    return this.usersRepository.find({
      where: { org_id: orgId, deleted_on: IsNull() },
      relations: this.getStandardRelations(),
    });
  }

  /**
   * Advanced user search with pagination and filtering
   * Supports multiple filters: role, organization, manager, location, dates, etc.
   * ClientAdmin restricted to their organization
   */
  async findUsersWithPagination(
    queryDto: UserQueryDto,
    requestingUser: any,
  ): Promise<PaginatedResponseDto<User>> {
    try {
      // Validate that specific resource IDs exist before querying
      await this.validateQueryResources(queryDto);

      const queryBuilder = this.buildUserQuery(queryDto, requestingUser);

      // Apply pagination and get results
      const page = queryDto.page || 1;
      const limit = queryDto.limit || 20;
      const result = await QueryBuilderHelper.paginate(queryBuilder, page, limit);

      // Create pagination metadata
      const pagination = new PaginationMetaDto(page, limit, result.total);

      // Create applied filters object
      const appliedFilters = QueryBuilderHelper.buildAppliedFilters({
        role: queryDto.role,
        orgId: queryDto.orgId,
        managerId: queryDto.managerId,
        active: queryDto.active,
        location: queryDto.location,
        deviceNo: queryDto.deviceNo,
        toolId: queryDto.toolId,
        phone: queryDto.phone,
        joinedAfter: queryDto.joinedAfter,
        joinedBefore: queryDto.joinedBefore,
        updatedAfter: queryDto.updatedAfter,
        updatedBefore: queryDto.updatedBefore,
        search: queryDto.search,
      });

      return new PaginatedResponseDto(result.data, pagination, appliedFilters);
    } catch (error) {
      console.error('Error in findUsersWithPagination:', error);

      // Handle specific error types according to HTTP status codes
      if (error instanceof BadRequestException) {
        throw error; // Re-throw validation errors (400)
      }

      // Handle malformed query parameters (400)
      if (error.message && error.message.includes('invalid')) {
        throw new BadRequestException({
          message: 'Malformed query parameters',
          details: 'Please check your query parameters and try again',
          error: error.message,
        });
      }

      // Handle unprocessable entity (422) - valid format but can't be processed
      throw new UnprocessableEntityException({
        message: 'Query parameters are valid but cannot be processed',
        details: 'Please check your filter values and try again',
        error: error.message,
      });
    }
  }

  // ----------------------------------------------------------------------------
  // 5. STATISTICS OPERATIONS (PlatformAdmin & ClientAdmin)
  // ----------------------------------------------------------------------------

  /**
   * Gets basic user statistics (total, active, inactive)
   * ClientAdmin sees only their organization stats
   */
  async getUserStats(requestingUser: any): Promise<any> {
    const whereCondition = this.buildWhereCondition(requestingUser);

    const totalUsers = await this.usersRepository.count({
      where: whereCondition,
    });
    const activeUsers = await this.usersRepository.count({
      where: {
        ...whereCondition,
        last_login: MoreThan(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
      },
    });

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
    };
  }

  /**
   * Gets user count breakdown by role
   * ClientAdmin sees only their organization stats
   */
  async getUserStatsByRole(requestingUser: any): Promise<any> {
    const whereCondition = this.buildWhereCondition(requestingUser);

    const roles = ['PlatformAdmin', 'ClientAdmin', 'Manager', 'Learner'];
    const stats: any = {};

    for (const role of roles) {
      stats[role] = await this.usersRepository.count({
        where: { ...whereCondition, role },
      });
    }

    return stats;
  }

  /**
   * Gets user count breakdown by organization
   * PlatformAdmin only
   */
  async getUserStatsByOrganization(requestingUser: any): Promise<any> {
    // Only PlatformAdmin can see stats by organization
    if (requestingUser.role !== 'PlatformAdmin') {
      return {};
    }

    const organizations = await this.usersRepository
      .createQueryBuilder('user')
      .select('org_id')
      .addSelect('COUNT(*)', 'count')
      .where('deleted_on IS NULL')
      .groupBy('org_id')
      .getRawMany();

    return organizations.reduce((acc, org) => {
      acc[org.org_id] = parseInt(org.count);
      return acc;
    }, {});
  }

  // ----------------------------------------------------------------------------
  // 6. PASSWORD MANAGEMENT
  // ----------------------------------------------------------------------------

  /**
   * Allows a user to change their own password
   * Requires current password verification
   */
  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.findOne(userId);
    if (!user) {
      return this.createErrorResponse('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password_hash,
    );
    if (!isCurrentPasswordValid) {
      return this.createErrorResponse('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await this.hashPassword(newPassword);

    // Update password
    await this.usersRepository.update(userId, {
      password_hash: hashedNewPassword,
      updated_on: new Date(),
    });

    return this.createSuccessResponse('Password changed successfully');
  }

  /**
   * Allows admins to reset a user's password
   * No current password verification required
   * ClientAdmin can only reset passwords in their organization
   */
  async resetPassword(
    userId: number,
    newPassword: string,
    requestingUser: any,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.findOne(userId);
    if (!user) {
      return this.createErrorResponse('User not found');
    }

    // Check permissions
    if (this.checkClientAdminPermission(requestingUser, user.org_id)) {
      return this.createErrorResponse(
        'Not authorized to reset password for this user',
      );
    }

    // Hash new password
    const hashedNewPassword = await this.hashPassword(newPassword);

    // Update password
    await this.usersRepository.update(userId, {
      password_hash: hashedNewPassword,
      updated_on: new Date(),
    });

    return this.createSuccessResponse('Password reset successfully');
  }

  // ----------------------------------------------------------------------------
  // 7. SPECIALIZED QUERIES
  // ----------------------------------------------------------------------------

  /**
   * Finds all individual learners (learners without an organization)
   */
  async findIndividualLearners(): Promise<User[]> {
    return this.usersRepository.find({
      where: {
        role: 'Learner',
        org_id: IsNull(),
        deleted_on: IsNull(),
      },
      relations: this.getStandardRelations(),
    });
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  // ----------------------------------------------------------------------------
  // Utility Helpers
  // ----------------------------------------------------------------------------

  /**
   * Hashes a password using bcrypt
   */
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Returns standard relations to load with user queries
   */
  private getStandardRelations(): string[] {
    return ['organization', 'manager'];
  }

  /**
   * Builds a where condition based on requesting user's role
   * ClientAdmin is restricted to their organization
   */
  private buildWhereCondition(requestingUser: any): any {
    const whereCondition: any = { deleted_on: IsNull() };
    if (requestingUser.role === 'ClientAdmin' && requestingUser.orgId != null) {
      whereCondition.org_id = requestingUser.orgId;
    }
    return whereCondition;
  }

  /**
   * Checks if ClientAdmin is trying to access a user outside their organization
   */
  private checkClientAdminPermission(
    requestingUser: any,
    userOrgId: number,
  ): boolean {
    return (
      requestingUser.role === 'ClientAdmin' &&
      requestingUser.orgId != null &&
      userOrgId !== requestingUser.orgId
    );
  }

  // ----------------------------------------------------------------------------
  // Response Helpers
  // ----------------------------------------------------------------------------

  /**
   * Creates a standardized error response
   */
  private createErrorResponse(message: string): {
    success: boolean;
    message: string;
  } {
    return {
      success: false,
      message,
    };
  }

  /**
   * Creates a standardized success response
   */
  private createSuccessResponse(message: string): {
    success: boolean;
    message: string;
  } {
    return {
      success: true,
      message,
    };
  }

  // ----------------------------------------------------------------------------
  // Validation Helpers
  // ----------------------------------------------------------------------------

  /**
   * Validates that a user exists and is not deleted
   * @throws NotFoundException if user doesn't exist
   */
  private async validateUserExists(userId: number): Promise<User> {
    const user = await this.findOne(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return user;
  }

  /**
   * Validates that a manager can be deleted (no active learners)
   * @throws BadRequestException if manager has active learners
   */
  private async validateManagerDeletion(
    managerId: number,
    orgId: number,
  ): Promise<void> {
    const activeLearners = await this.usersRepository.find({
      where: {
        manager_id: managerId,
        org_id: orgId,
        deleted_on: IsNull(),
      },
    });

    if (activeLearners.length > 0) {
      const learnerNames = activeLearners
        .map((learner) => learner.name)
        .join(', ');
      throw new BadRequestException(
        `Cannot delete manager. They have ${activeLearners.length} active learner(s): ${learnerNames}. `,
      );
    }
  }

  /**
   * Validates that a ClientAdmin can be deleted (no active users in organization)
   * @throws BadRequestException if ClientAdmin has active users
   */
  private async validateClientAdminDeletion(orgId: number): Promise<void> {
    const activeUsers = await this.usersRepository.find({
      where: {
        org_id: orgId,
        deleted_on: IsNull(),
        id: MoreThan(0),
      },
    });

    if (activeUsers.length > 0) {
      const userBreakdown = activeUsers.reduce((acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1;
        return acc;
      }, {});

      const breakdownText = Object.entries(userBreakdown)
        .map(([role, count]) => `${count} ${role}(s)`)
        .join(', ');

      throw new BadRequestException(
        `Cannot delete ClientAdmin. They have ${activeUsers.length} active user(s) in the organization: ${breakdownText}.`,
      );
    }
  }

  /**
   * Validates email uniqueness when updating
   * @throws ConflictException if email already exists
   */
  private async validateEmailUniqueness(
    email: string | undefined,
    currentEmail: string,
  ): Promise<void> {
    if (email && email !== currentEmail) {
      const duplicateEmail = await this.findByEmail(email);
      if (duplicateEmail) {
        throw new ConflictException(`User with email ${email} already exists`);
      }
    }
  }

  /**
   * Validates manager creation rules
   * Manager requires a ClientAdmin in the organization
   */
  private async validateManagerCreation(
    createUserDto: CreateUserDto,
  ): Promise<boolean> {
    // If creating a manager, ensure ClientAdmin exists in the organization
    if (
      createUserDto.role === 'Manager' &&
      createUserDto.org_id &&
      createUserDto.org_id > 0
    ) {
      const clientAdmin = await this.usersRepository.findOne({
        where: {
          org_id: createUserDto.org_id,
          role: 'ClientAdmin',
          deleted_on: IsNull(),
        },
      });

      if (!clientAdmin) {
        throw new BadRequestException(
          'Cannot create Manager: No ClientAdmin exists in the organization',
        );
      }
    }
    return true;
  }

  /**
   * Validates PlatformAdmin creation rules
   * Only one PlatformAdmin allowed in the system
   */
  private async validatePlatformAdminCreation(
    createUserDto: CreateUserDto,
  ): Promise<boolean> {
    // If creating a PlatformAdmin, ensure no other PlatformAdmin exists in the system
    if (createUserDto.role === 'PlatformAdmin') {
      const existingPlatformAdmin = await this.usersRepository.findOne({
        where: {
          role: 'PlatformAdmin',
          deleted_on: IsNull(),
        },
      });

      if (existingPlatformAdmin) {
        throw new ConflictException(
          'Cannot create PlatformAdmin: A PlatformAdmin already exists in the system',
        );
      }
    }
    return true;
  }

  /**
   * Validates ClientAdmin creation rules
   * Only one ClientAdmin per organization
   */
  private async validateClientAdminCreation(
    createUserDto: CreateUserDto,
  ): Promise<boolean> {
    // If creating a ClientAdmin, ensure no other ClientAdmin exists in the organization
    if (
      createUserDto.role === 'ClientAdmin' &&
      createUserDto.org_id &&
      createUserDto.org_id > 0
    ) {
      const existingClientAdmin = await this.usersRepository.findOne({
        where: {
          org_id: createUserDto.org_id,
          role: 'ClientAdmin',
          deleted_on: IsNull(),
        },
      });

      if (existingClientAdmin) {
        throw new ConflictException(
          'Cannot create ClientAdmin: Organization already has a ClientAdmin',
        );
      }
    }
    return true;
  }

  /**
   * Validates user update rules (especially role changes)
   * Enforces PlatformAdmin, ClientAdmin, and Manager restrictions
   */
  private async validateUserUpdate(
    id: number,
    updateUserDto: UpdateUserDto,
  ): Promise<boolean> {
    // Prevent updating role to PlatformAdmin (only one Platform Admin allowed)
    if (updateUserDto.role === 'PlatformAdmin') {
      const currentUser = await this.findOne(id);

      // If user is already a Platform Admin, allow the update
      if (currentUser && currentUser.role === 'PlatformAdmin') {
        return true;
      }

      // Otherwise, check if another Platform Admin exists
      const existingPlatformAdmin = await this.usersRepository.findOne({
        where: {
          role: 'PlatformAdmin',
          deleted_on: IsNull(),
        },
      });

      if (existingPlatformAdmin) {
        throw new ConflictException(
          'Cannot update to PlatformAdmin: A PlatformAdmin already exists in the system',
        );
      }
    }

    // If updating role to ClientAdmin, check if another ClientAdmin exists
    if (updateUserDto.role === 'ClientAdmin') {
      const currentUser = await this.findOne(id);
      if (!currentUser) {
        throw new BadRequestException('User not found');
      }

      const existingClientAdmin = await this.usersRepository.findOne({
        where: {
          org_id: currentUser.org_id,
          role: 'ClientAdmin',
          deleted_on: IsNull(),
          id: MoreThan(0), // Exclude current user
        },
      });

      if (existingClientAdmin) {
        throw new ConflictException(
          'Cannot update to ClientAdmin: Organization already has a ClientAdmin',
        );
      }
    }

    // If updating role to Manager, ensure ClientAdmin exists
    if (updateUserDto.role === 'Manager') {
      const currentUser = await this.findOne(id);
      if (!currentUser) {
        throw new BadRequestException('User not found');
      }

      const clientAdmin = await this.usersRepository.findOne({
        where: {
          org_id: currentUser.org_id,
          role: 'ClientAdmin',
          deleted_on: IsNull(),
        },
      });

      if (!clientAdmin) {
        throw new BadRequestException(
          'Cannot update to Manager: No ClientAdmin exists in the organization',
        );
      }
    }

    return true;
  }

  /**
   * Validates that specific resources referenced in query filters actually exist
   * @throws NotFoundException if a specified resource doesn't exist
   */
  private async validateQueryResources(queryDto: UserQueryDto): Promise<void> {
    // Validate organization exists if orgId is specified
    if (queryDto.orgId !== undefined && queryDto.orgId !== null) {
      const organization = await this.organizationsRepository.findOne({
        where: {
          id: queryDto.orgId,
          deleted_on: IsNull(),
        },
      });

      if (!organization) {
        throw new NotFoundException(
          `Organization with ID ${queryDto.orgId} not found`,
        );
      }
    }

    // Validate manager exists if managerId is specified
    if (queryDto.managerId !== undefined && queryDto.managerId !== null) {
      const manager = await this.usersRepository.findOne({
        where: {
          id: queryDto.managerId,
          deleted_on: IsNull(),
        },
      });

      if (!manager) {
        throw new NotFoundException(
          `Manager with ID ${queryDto.managerId} not found`,
        );
      }

      // Validate that the user is actually a manager
      if (manager.role !== UserRole.MANAGER) {
        throw new BadRequestException(
          `User with ID ${queryDto.managerId} is not a manager`,
        );
      }
    }
  }

  // ----------------------------------------------------------------------------
  // Cleanup Helpers
  // ----------------------------------------------------------------------------

  /**
   * Cleans up user domain associations before deletion
   */
  private async cleanupUserDomains(
    userId: number,
    context: string = '',
  ): Promise<void> {
    try {
      const result = await this.userDomainsService.listUserDomains(userId, { page: 1, limit: 1000 });
      const userDomains = result.data || [];
      if (userDomains.length > 0) {
        for (const domain of userDomains) {
          await this.userDomainsService.unlink(userId, domain.id);
        }
        console.log(
          `Cleaned up ${userDomains.length} domain associations for user ${userId}${context}`,
        );
      }
    } catch (error) {
      console.error(
        `Error cleaning up domain associations for user ${userId}${context}:`,
        error,
      );
      // Continue even if domain cleanup fails
    }
  }

  /**
   * Cleans up user module enrollments before deletion
   */
  private async cleanupUserModules(
    userId: number,
    context: string = '',
  ): Promise<void> {
    try {
      const cleanedCount =
        await this.userModulesService.cleanupUserModules(userId);
      if (cleanedCount > 0) {
        console.log(
          `Cleaned up ${cleanedCount} module enrollment(s) for user ${userId}${context}`,
        );
      }
    } catch (error) {
      console.error(
        `Error cleaning up module enrollments for user ${userId}${context}:`,
        error,
      );
      // Continue even if module cleanup fails
    }
  }

  private async cleanupUserTopics(
    userId: number,
    context: string = '',
  ): Promise<void> {
    try {
      const cleanedCount =
        await this.userTopicsService.cleanupTopicsForUser(userId);
      if (cleanedCount > 0) {
        console.log(
          `Cleaned up ${cleanedCount} topic assignment(s) for user ${userId}${context}`,
        );
      }
    } catch (error) {
      console.error(
        `Error cleaning up topic assignments for user ${userId}${context}:`,
        error,
      );
      // Continue even if topic cleanup fails
    }
  }

  // ----------------------------------------------------------------------------
  // Update Helpers
  // ----------------------------------------------------------------------------

  /**
   * Prepares update data by hashing password if provided
   */
  private async prepareUpdateData(updateUserDto: UpdateUserDto): Promise<any> {
    const updateData: any = { ...updateUserDto };

    if (updateUserDto.password) {
      updateData.password_hash = await this.hashPassword(
        updateUserDto.password,
      );
      delete updateData.password;
    }

    return updateData;
  }

  /**
   * Reassigns manager's team members to ClientAdmin before manager deletion
   * Returns count of reassigned team members
   */
  private async reassignManagerTeamMembers(
    managerId: number,
    orgId: number,
  ): Promise<number> {
    const teamMembers = await this.usersRepository.find({
      where: { manager_id: managerId, org_id: orgId, deleted_on: IsNull() },
    });

    const teamMembersCount = teamMembers.length;

    if (teamMembers.length > 0) {
      // Find ClientAdmin in the same organization
      const clientAdmin = await this.usersRepository.findOne({
        where: {
          org_id: orgId,
          role: 'ClientAdmin',
          deleted_on: IsNull(),
        },
      });

      if (clientAdmin) {
        // Reassign team members to ClientAdmin
        await this.usersRepository.update(
          { manager_id: managerId, org_id: orgId, deleted_on: IsNull() },
          { manager_id: clientAdmin.id },
        );
      } else {
        // Business rule: If no ClientAdmin exists, managers shouldn't exist either
        // This indicates a data integrity issue - log it and handle appropriately
        console.error(
          `Data integrity issue: Manager ${managerId} exists without ClientAdmin in org ${orgId}`,
        );

        // Remove manager assignment and log the issue
        await this.usersRepository.update(
          { manager_id: managerId, org_id: orgId, deleted_on: IsNull() },
          { manager_id: null },
        );

        // Note: In a production system, you might want to throw an error or
        // prevent deletion until ClientAdmin is assigned to maintain data integrity
      }
    }

    return teamMembersCount;
  }

  // ----------------------------------------------------------------------------
  // Query Building Helpers (for findUsersWithPagination)
  // ----------------------------------------------------------------------------

  /**
   * Builds a query builder with filters and sorting for pagination
   */
  private buildUserQuery(
    queryDto: UserQueryDto,
    requestingUser: any,
  ): SelectQueryBuilder<User> {
    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .where('user.deleted_on IS NULL');

    // Apply role-based access control
    if (requestingUser.role === 'ClientAdmin' && requestingUser.orgId != null) {
      queryBuilder.andWhere('user.org_id = :orgId', {
        orgId: requestingUser.orgId,
      });
    }

    // Apply filters using QueryBuilderHelper
    QueryBuilderHelper.applyEqualityFilter(queryBuilder, 'user', 'role', queryDto.role);
    QueryBuilderHelper.applyEqualityFilter(queryBuilder, 'user', 'org_id', queryDto.orgId);
    QueryBuilderHelper.applyEqualityFilter(queryBuilder, 'user', 'manager_id', queryDto.managerId);
    QueryBuilderHelper.applyEqualityFilter(queryBuilder, 'user', 'tool_id', queryDto.toolId);
    QueryBuilderHelper.applyLikeFilter(queryBuilder, 'user', 'location', queryDto.location);
    QueryBuilderHelper.applyLikeFilter(queryBuilder, 'user', 'registered_device_no', queryDto.deviceNo);
    QueryBuilderHelper.applyLikeFilter(queryBuilder, 'user', 'user_phone', queryDto.phone);

    // Active filter (based on last_login)
    if (queryDto.active !== undefined) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (queryDto.active) {
        queryBuilder.andWhere('user.last_login > :thirtyDaysAgo', { thirtyDaysAgo });
      } else {
        queryBuilder.andWhere(
          '(user.last_login IS NULL OR user.last_login <= :thirtyDaysAgo)',
          { thirtyDaysAgo },
        );
      }
    }

    // Date range filters
    QueryBuilderHelper.applyDateRangeFilter(
      queryBuilder,
      'user',
      'joined_on',
      queryDto.joinedAfter,
      queryDto.joinedBefore,
    );
    QueryBuilderHelper.applyDateRangeFilter(
      queryBuilder,
      'user',
      'updated_on',
      queryDto.updatedAfter,
      queryDto.updatedBefore,
    );

    // Search filter (name or email)
    if (queryDto.search) {
      QueryBuilderHelper.applySearch(
        queryBuilder,
        'user',
        ['name', 'email'],
        queryDto.search,
      );
    }

    // Apply sorting
    const columnMap = {
      [SortBy.NAME]: 'name',
      [SortBy.EMAIL]: 'email',
      [SortBy.ROLE]: 'role',
      [SortBy.JOINED_ON]: 'joined_on',
      [SortBy.UPDATED_ON]: 'updated_on',
      [SortBy.LOCATION]: 'location',
      [SortBy.USER_PHONE]: 'user_phone',
    };
    QueryBuilderHelper.applySorting(
      queryBuilder,
      'user',
      columnMap,
      queryDto.sortBy,
      queryDto.sortOrder,
      'email',
    );

    return queryBuilder;
  }

}
