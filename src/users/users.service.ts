import {
  Injectable,
  ConflictException,
  BadRequestException,
  UnprocessableEntityException,
  NotFoundException,
  ForbiddenException,
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
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateIndividualUserDto } from './dto/create-individual-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from './dto/paginated-response.dto';
import { UserDomainsService } from '../user-domains/user-domains.service';
import { UserDomain } from '../user-domains/entities/user-domain.entity';
import { UserModule } from '../user-modules/entities/user-module.entity';
import { UserTopicsService } from '../user-topics/user-topics.service';
import { UserRole } from '../common/constants/user-roles';
import { Organization } from '../organizations/entities/organization.entity';
import { QueryBuilderHelper } from '../common/utils/query-builder.helper';
import { OtpService } from '../otp/otp.service';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Organization)
    private organizationsRepository: Repository<Organization>,
    @InjectRepository(UserDomain)
    private userDomainRepository: Repository<UserDomain>,
    @InjectRepository(UserModule)
    private userModuleRepository: Repository<UserModule>,
    private readonly userDomainsService: UserDomainsService,
    @Inject(forwardRef(() => UserTopicsService))
    private readonly userTopicsService: UserTopicsService,
    private readonly otpService: OtpService,
    private readonly mailService: MailService,
    private readonly redisService: RedisService,
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
        throw new ConflictException(
          `User with email ${createUserDto.email} already exists`,
        );
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
   * Registers a new user with OTP verification
   * Creates user, sends OTP to email
   */
  async registerWithOtp(createUserDto: CreateUserDto | CreateIndividualUserDto) {
    try {
      console.log('DEBUG: Starting registerWithOtp');
      
      // Check if user with this email already exists
      const existingUser = await this.usersRepository.findOne({
        where: { email: createUserDto.email },
      });

      console.log('DEBUG: Existing user check complete', existingUser ? 'Found' : 'Not found');

      // If user exists and has password/email filled in (complete user), throw error
      if (existingUser && existingUser.password_hash && existingUser.name) {
        throw new ConflictException(
          `User with email ${createUserDto.email} already exists`,
        );
      }

      // NEW: If user row not created yet, allow through when Redis pre-verification exists
      if (!existingUser) {
        const preVerified = await this.redisService.get<string>(
          `pre_register_verified:${createUserDto.email}`
        );
        if (!preVerified) {
          throw new BadRequestException('Please verify your email first using the OTP.');
        }

        // Create user (no is_verified needed)
        const user = await this.create(createUserDto);
        await this.usersRepository.save(user);

        // Clear Redis flag
        await this.redisService.set(`pre_register_verified:${createUserDto.email}`, null, 0);

        return {
          message: 'Registration successful. Email already verified.',
          id: user.id,
          email: user.email,
        };
      }

      // If existing user is pending (missing critical fields), complete it
      const isPending =
        !existingUser.password_hash ||
        !existingUser.name ||
        !existingUser.role ||
        !existingUser.registered_device_no;

      if (isPending) {
        existingUser.name = (createUserDto as any).name;
        existingUser.password_hash = await this.hashPassword((createUserDto as any).password);
        existingUser.role = (createUserDto as any).role || 'Learner';
        existingUser.registered_device_no = (createUserDto as any).registered_device_no;
        // When not provided, leave as-is to satisfy Date type
        if ((createUserDto as any).dob) {
          existingUser.dob = new Date((createUserDto as any).dob);
        }
        existingUser.user_phone = (createUserDto as any).user_phone ?? null;
        existingUser.location = (createUserDto as any).location ?? null;
        // Newly added optional profile fields
        existingUser.profession = (createUserDto as any).profession ?? null;
        existingUser.highest_qualification = (createUserDto as any).highest_qualification ?? null;
        existingUser.highest_qualification_specialization = (createUserDto as any).highest_qualification_specialization ?? null;
        existingUser.tool_id = (createUserDto as any).tool_id ?? null;
        existingUser.org_id = (createUserDto as any).org_id ?? null;
        existingUser.manager_id = (createUserDto as any).manager_id ?? null;

        await this.usersRepository.save(existingUser);
        return {
          message: 'Registration completed',
          id: existingUser.id,
          email: existingUser.email,
        };
      }

      // If user exists and is fully complete already, block duplicate
      if (existingUser && !isPending) {
        throw new ConflictException(
          `User with email ${createUserDto.email} already exists`,
        );
      }
    } catch (error) {
      console.error('ERROR in registerWithOtp:', error);
      console.error('ERROR stack:', error.stack);
      throw error;
    }
  }

  /**
   * Finds a single user by ID (only non-deleted users)
   */
  async findOne(id: number): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id: id },
    });
  }


  /**
   * Finds a user by email address (only non-deleted users)
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
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
   * Soft deletes a user (marks as deleted)
   * Cleans up associated user domains and modules
   */
  async remove(id: number): Promise<void> {
    // Check if user exists
    const existingUser = await this.findOne(id);
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    // Clean up user modules and topics before deletion
    await this.cleanupUserModules(id, ' before deletion');
    await this.cleanupUserTopics(id, ' before deletion');

    // Soft delete the user
    await this.usersRepository.softDelete(id);
  }




  // ----------------------------------------------------------------------------
  // 2. ORGANIZATION-SCOPED OPERATIONS (ClientAdmin & PlatformAdmin)
  // ----------------------------------------------------------------------------

  /**
   * Finds all users in a specific organization
   */
  async findByOrganization(orgId: number): Promise<User[]> {
    return this.usersRepository.find({
      where: { org_id: orgId },
      relations: this.getStandardRelations(),
    });
  }

  /**
   * Finds a specific user within an organization
   */
  async findOneInOrganization(id: number, orgId: number): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id: id, org_id: orgId },
      relations: this.getStandardRelations(),
    });
  }

  /**
   * Finds a specific user within an organization (without organization/manager details)
   * Used for organization users endpoints to avoid including organization details
   */
  async findOneInOrganizationWithoutDetails(id: number, orgId: number): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id: id, org_id: orgId },
    });
  }

  /**
   * Updates a user within an organization context
   * User MUST already belong to the organization to be updated
   */
  async updateInOrganization(
    id: number,
    orgId: number,
    updateUserDto: UpdateUserDto,
  ): Promise<User> {
    // User must already exist in the organization
    const user = await this.findOneInOrganization(id, orgId);
    
    if (!user) {
      // Check if user exists at all to provide better error message
      const existingUser = await this.findOne(id);
      if (!existingUser) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      throw new BadRequestException(
        `User with ID ${id} does not belong to organization ${orgId}. ` +
        `Users can only be updated if they already belong to the organization.`
      );
    }

    // Prevent changing org_id to a different organization via this endpoint
    if (updateUserDto.org_id !== undefined && updateUserDto.org_id !== orgId) {
      throw new BadRequestException(
        `Cannot change organization affiliation via organization-centric API. ` +
        `User already belongs to organization ${orgId}`
      );
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
    
    const updatedUser = await this.findOneInOrganization(id, orgId);
    if (!updatedUser) {
      throw new NotFoundException(
        `User with ID ${id} not found in organization ${orgId} after update`
      );
    }
    
    return updatedUser;
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

    // Perform hard delete
    await this.usersRepository.delete(id);

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
      },
      relations: this.getStandardRelations(),
    });
  }

  /**
   * Finds users with pagination and filtering
   * Supports deleted=true query parameter to show only soft-deleted users
   */
  async findUsersWithPagination(
    queryDto: UserQueryDto,
    requestingUser: any,
  ): Promise<PaginatedResponseDto<User>> {
    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.organization', 'organization');

    // Handle deleted filter
    if (queryDto.deleted === true) {
      queryBuilder.andWhere('user.deleted_on IS NOT NULL');
    } else {
      queryBuilder.andWhere('user.deleted_on IS NULL');
    }

    // ClientAdmin can only see users in their organization
    // Also apply organization filter if orgId is provided in the requesting user
    if (requestingUser.role === UserRole.CLIENT_ADMIN || requestingUser.orgId) {
      queryBuilder.andWhere('user.org_id = :orgId', {
        orgId: requestingUser.orgId,
      });
    }

    // Apply other filters
    if (queryDto.role) {
      queryBuilder.andWhere('user.role = :role', { role: queryDto.role });
    }

    if (queryDto.orgId !== undefined && queryDto.orgId !== null) {
      queryBuilder.andWhere('user.org_id = :orgId', { orgId: queryDto.orgId });
    }

    if (queryDto.managerId !== undefined && queryDto.managerId !== null) {
      queryBuilder.andWhere('user.manager_id = :managerId', { managerId: queryDto.managerId });
    }

    if (queryDto.location) {
      queryBuilder.andWhere('user.location LIKE :location', {
        location: `%${queryDto.location}%`,
      });
    }

    if (queryDto.phone) {
      queryBuilder.andWhere('user.user_phone LIKE :phone', {
        phone: `%${queryDto.phone}%`,
      });
    }

    if (queryDto.search) {
      queryBuilder.andWhere(
        '(user.name LIKE :search OR user.email LIKE :search)',
        { search: `%${queryDto.search}%` },
      );
    }

    // Apply sorting
    const sortField = queryDto.sortBy || 'email';
    const sortOrder = queryDto.sortOrder || 'ASC';
    queryBuilder.orderBy(`user.${sortField}`, sortOrder.toUpperCase() as 'ASC' | 'DESC');

    // Apply pagination
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;
    const offset = (page - 1) * limit;

    queryBuilder.skip(offset).take(limit);

    const [users, total] = await queryBuilder.getManyAndCount();

    const meta: PaginationMetaDto = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    return new PaginatedResponseDto(users, meta);
  }

  /**
   * Finds users with pagination for main users endpoint (without organization details)
   * Used for the main /v1/users endpoint to avoid including organization details
   */
  async findUsersWithPaginationWithoutDetails(
    queryDto: UserQueryDto,
    requestingUser: any,
  ): Promise<PaginatedResponseDto<User>> {
    const queryBuilder = this.usersRepository
      .createQueryBuilder('user');

    // Handle deleted filter
    if (queryDto.deleted === true) {
      queryBuilder.andWhere('user.deleted_on IS NOT NULL');
    } else {
      queryBuilder.andWhere('user.deleted_on IS NULL');
    }

    // ClientAdmin can only see users in their organization
    // Also apply organization filter if orgId is provided in the requesting user
    if (requestingUser.role === UserRole.CLIENT_ADMIN || requestingUser.orgId) {
      queryBuilder.andWhere('user.org_id = :orgId', {
        orgId: requestingUser.orgId,
      });
    }

    // Apply search filter
    if (queryDto.search) {
      queryBuilder.andWhere(
        '(user.name LIKE :search OR user.email LIKE :search)',
        { search: `%${queryDto.search}%` }
      );
    }

    // Apply other filters
    if (queryDto.role) {
      queryBuilder.andWhere('user.role = :role', { role: queryDto.role });
    }

    if (queryDto.orgId !== undefined && queryDto.orgId !== null) {
      queryBuilder.andWhere('user.org_id = :orgId', { orgId: queryDto.orgId });
    }

    if (queryDto.location) {
      queryBuilder.andWhere('user.location LIKE :location', {
        location: `%${queryDto.location}%`,
      });
    }

    if (queryDto.deviceNo) {
      queryBuilder.andWhere('user.registered_device_no LIKE :deviceNo', {
        deviceNo: `%${queryDto.deviceNo}%`,
      });
    }

    if (queryDto.toolId !== undefined && queryDto.toolId !== null) {
      queryBuilder.andWhere('user.tool_id = :toolId', { toolId: queryDto.toolId });
    }

    if (queryDto.managerId !== undefined && queryDto.managerId !== null) {
      queryBuilder.andWhere('user.manager_id = :managerId', {
        managerId: queryDto.managerId,
      });
    }

    if (queryDto.phone) {
      queryBuilder.andWhere('user.user_phone LIKE :phone', {
        phone: `%${queryDto.phone}%`,
      });
    }

    // Apply date range filters
    if (queryDto.joinedAfter) {
      queryBuilder.andWhere('user.joined_on >= :joinedAfter', {
        joinedAfter: queryDto.joinedAfter,
      });
    }

    if (queryDto.joinedBefore) {
      queryBuilder.andWhere('user.joined_on <= :joinedBefore', {
        joinedBefore: queryDto.joinedBefore,
      });
    }

    if (queryDto.updatedAfter) {
      queryBuilder.andWhere('user.updated_on >= :updatedAfter', {
        updatedAfter: queryDto.updatedAfter,
      });
    }

    if (queryDto.updatedBefore) {
      queryBuilder.andWhere('user.updated_on <= :updatedBefore', {
        updatedBefore: queryDto.updatedBefore,
      });
    }

    // Apply sorting
    const { sortBy, sortOrder } = queryDto;
    if (sortBy && sortOrder) {
      const columnMap = {
        name: 'name',
        email: 'email',
        role: 'role',
        joinedOn: 'joined_on',
        updatedOn: 'updated_on',
        location: 'location',
        userPhone: 'user_phone',
      };
      QueryBuilderHelper.applySorting(
        queryBuilder,
        'user',
        columnMap,
        sortBy,
        sortOrder,
        'name',
      );
    }

    // Apply pagination
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;
    
    // Get total count
    const total = await queryBuilder.getCount();
    
    // Apply pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);
    
    // Get paginated data
    const users = await queryBuilder.getMany();
    
    // Create pagination meta
    const meta: PaginationMetaDto = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    return new PaginatedResponseDto(users, meta);
  }

  /**
   * Finds users with pagination for organization endpoints (without organization details)
   * Used specifically for organization users endpoints to avoid including organization details
   */
  async findOrganizationUsersWithPagination(
    queryDto: UserQueryDto,
    requestingUser: any,
  ): Promise<PaginatedResponseDto<User>> {
    const queryBuilder = this.usersRepository
      .createQueryBuilder('user');

    // Handle deleted filter
    if (queryDto.deleted === true) {
      queryBuilder.andWhere('user.deleted_on IS NOT NULL');
    } else {
      queryBuilder.andWhere('user.deleted_on IS NULL');
    }

    // ClientAdmin can only see users in their organization
    // Also apply organization filter if orgId is provided in the requesting user
    if (requestingUser.role === UserRole.CLIENT_ADMIN || requestingUser.orgId) {
      queryBuilder.andWhere('user.org_id = :orgId', {
        orgId: requestingUser.orgId,
      });
    }

    // Apply search filter
    if (queryDto.search) {
      queryBuilder.andWhere(
        '(user.name LIKE :search OR user.email LIKE :search)',
        { search: `%${queryDto.search}%` }
      );
    }

    // Apply other filters
    if (queryDto.role) {
      queryBuilder.andWhere('user.role = :role', { role: queryDto.role });
    }

    if (queryDto.orgId !== undefined && queryDto.orgId !== null) {
      queryBuilder.andWhere('user.org_id = :orgId', { orgId: queryDto.orgId });
    }

    if (queryDto.location) {
      queryBuilder.andWhere('user.location LIKE :location', {
        location: `%${queryDto.location}%`,
      });
    }

    if (queryDto.deviceNo) {
      queryBuilder.andWhere('user.registered_device_no LIKE :deviceNo', {
        deviceNo: `%${queryDto.deviceNo}%`,
      });
    }

    if (queryDto.toolId !== undefined && queryDto.toolId !== null) {
      queryBuilder.andWhere('user.tool_id = :toolId', { toolId: queryDto.toolId });
    }

    if (queryDto.managerId !== undefined && queryDto.managerId !== null) {
      queryBuilder.andWhere('user.manager_id = :managerId', {
        managerId: queryDto.managerId,
      });
    }

    if (queryDto.phone) {
      queryBuilder.andWhere('user.user_phone LIKE :phone', {
        phone: `%${queryDto.phone}%`,
      });
    }

    // Apply date range filters
    if (queryDto.joinedAfter) {
      queryBuilder.andWhere('user.joined_on >= :joinedAfter', {
        joinedAfter: queryDto.joinedAfter,
      });
    }

    if (queryDto.joinedBefore) {
      queryBuilder.andWhere('user.joined_on <= :joinedBefore', {
        joinedBefore: queryDto.joinedBefore,
      });
    }

    if (queryDto.updatedAfter) {
      queryBuilder.andWhere('user.updated_on >= :updatedAfter', {
        updatedAfter: queryDto.updatedAfter,
      });
    }

    if (queryDto.updatedBefore) {
      queryBuilder.andWhere('user.updated_on <= :updatedBefore', {
        updatedBefore: queryDto.updatedBefore,
      });
    }

    // Apply sorting
    const { sortBy, sortOrder } = queryDto;
    if (sortBy && sortOrder) {
      const columnMap = {
        name: 'name',
        email: 'email',
        role: 'role',
        joinedOn: 'joined_on',
        updatedOn: 'updated_on',
        location: 'location',
        userPhone: 'user_phone',
      };
      QueryBuilderHelper.applySorting(
        queryBuilder,
        'user',
        columnMap,
        sortBy,
        sortOrder,
        'name',
      );
    }

    // Apply pagination
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;
    
    // Get total count
    const total = await queryBuilder.getCount();
    
    // Apply pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);
    
    // Get paginated data
    const users = await queryBuilder.getMany();
    
    // Create pagination meta
    const meta: PaginationMetaDto = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    return new PaginatedResponseDto(users, meta);
  }

  /**
   * Searches users by name or email
   * ClientAdmin can only search within their organization
   */
  async searchUsers(query: string, requestingUser: any): Promise<User[]> {
    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.organization', 'organization')
      .where('(user.name LIKE :query OR user.email LIKE :query)', {
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
      where: { org_id: orgId },
      relations: this.getStandardRelations(),
    });
  }

  /**
   * Finds users by organization (without organization/manager details)
   * Used for organization users endpoints to avoid including organization details
   */
  async findByOrganizationWithoutDetails(orgId: number): Promise<User[]> {
    return this.usersRepository.find({
      where: { org_id: orgId },
    });
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
    const user = await this.usersRepository.findOne({
      where: { id: userId, deleted_on: IsNull() },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Build query to get user modules through user_domains and domain_modules
    const queryBuilder = this.userModuleRepository
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

    if (enroll !== undefined) {
      if (enroll === 'false') {
        // Get modules that user is NOT enrolled in
        queryBuilder.andWhere('um.id IS NULL');
      }
      // If enroll is true, no additional filter needed (shows enrolled modules)
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

    // Since we don't have last_login field, we'll use a different approach
    // For now, we'll consider all users as active since we don't have login tracking
    const activeUsers = totalUsers; // All users are considered active

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: 0, // No inactive users since we don't track last login
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
      },
      relations: this.getStandardRelations(),
    });
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Gets standard relations for user queries
   */
  private getStandardRelations(): string[] {
    return ['organization', 'manager'];
  }

  /**
   * Prepares update data for user updates
   */
  private async prepareUpdateData(updateUserDto: UpdateUserDto): Promise<any> {
    const updateData: any = { ...updateUserDto };

    // Hash password if provided
    if (updateUserDto.password) {
      updateData.password_hash = await this.hashPassword(updateUserDto.password);
      delete updateData.password;
    }

    // Convert dob string to Date if present
    if (updateUserDto.dob) {
      updateData.dob = new Date(updateUserDto.dob);
    }

    return updateData;
  }

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
   * Builds a where condition based on requesting user's role
   * ClientAdmin is restricted to their organization
   */
  private buildWhereCondition(requestingUser: any): any {
    const whereCondition: any = {};
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
   * Multiple PlatformAdmins are now allowed in the system
   */
  private async validatePlatformAdminCreation(
    createUserDto: CreateUserDto,
  ): Promise<boolean> {
    // Platform Admin creation is now allowed - no restrictions on multiple Platform Admins
    // This method is kept for consistency with other role validations
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
        },
      });

      if (existingPlatformAdmin) {
        throw new ForbiddenException(
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
          id: MoreThan(0), // Exclude current user
        },
      });

      if (existingClientAdmin) {
        throw new ForbiddenException(
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
        // Soft delete user domain associations
        await this.userDomainRepository.softDelete({ user_id: userId });
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
      const enrollments = await this.userModuleRepository
        .createQueryBuilder('um')
        .innerJoin('um.userDomain', 'ud')
        .where('ud.user_id = :userId', { userId })
        .getMany();

      if (enrollments.length > 0) {
        await this.userModuleRepository.remove(enrollments);
        console.log(
          `Cleaned up ${enrollments.length} module enrollment(s) for user ${userId}${context}`,
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


  

  /**
   * Restores a soft-deleted user and all their related data
   * Platform Admin can restore any user, Client Admin can restore only their org users
   */
  async restore(id: number, requestingUser: any): Promise<{ success: boolean; message: string }> {
    // Check if user exists (including soft-deleted)
    const user = await this.usersRepository.findOne({
      where: { id: id },
      withDeleted: true,
    });

    console.log(`Restore attempt for user ID ${id}:`, user ? 'User found' : 'User not found');
    if (user) {
      console.log(`User ${id} deleted_on status:`, user.deleted_on);
    }

    if (!user) {
      return this.createErrorResponse('User not found');
    }

    // Check if user is actually soft-deleted
    if (!user.deleted_on) {
      return this.createErrorResponse('User is not deleted');
    }

    // Permission check
    if (requestingUser.role === UserRole.CLIENT_ADMIN) {
      // Client Admin can only restore users in their organization
      if (user.org_id !== requestingUser.orgId) {
        return this.createErrorResponse(
          'Client Admin can only restore users in their own organization',
        );
      }
    }

    // Restore user associations
    await this.restoreUserDomains(id);
    await this.restoreUserTopics(id);
    await this.restoreUserModules(id);

    // Restore the user
    await this.usersRepository.restore(id);

    return this.createSuccessResponse('User restored successfully');
  }

  /**
   * Restores user domain associations
   */
  private async restoreUserDomains(userId: number): Promise<void> {
    try {
      await this.userDomainRepository.restore({ user_id: userId });
      console.log(`Restored domain associations for user ${userId}`);
    } catch (error) {
      console.error(`Error restoring domain associations for user ${userId}:`, error);
    }
  }

  /**
   * Restores user module enrollments
   */
  private async restoreUserModules(userId: number): Promise<void> {
    try {
      // Get all soft-deleted user modules for this user
      const userDomains = await this.userDomainRepository.find({
        where: { user_id: userId },
        withDeleted: true,
      });

      for (const userDomain of userDomains) {
        await this.userModuleRepository.restore({ user_domain_id: userDomain.id });
      }
      console.log(`Restored module enrollments for user ${userId}`);
    } catch (error) {
      console.error(`Error restoring module enrollments for user ${userId}:`, error);
    }
  }

  /**
   * Restores user topic assignments
   */
  private async restoreUserTopics(userId: number): Promise<void> {
    try {
      // Get all soft-deleted user modules for this user
      const userDomains = await this.userDomainRepository.find({
        where: { user_id: userId },
        withDeleted: true,
      });

      for (const userDomain of userDomains) {
        const userModules = await this.userModuleRepository.find({
          where: { user_domain_id: userDomain.id },
          withDeleted: true,
        });
        for (const userModule of userModules) {
          // Note: restoreTopicsForUserModule method needs to be implemented in UserTopicsService
          console.log(`Would restore topics for user module ${userModule.id}`);
        }
      }
      console.log(`Restored topic assignments for user ${userId}`);
    } catch (error) {
      console.error(`Error restoring topic assignments for user ${userId}:`, error);
    }
  }
  private async reassignManagerTeamMembers(
    managerId: number,
    orgId: number,
  ): Promise<number> {
    const teamMembers = await this.usersRepository.find({
      where: { manager_id: managerId, org_id: orgId },
    });

    const teamMembersCount = teamMembers.length;

    if (teamMembers.length > 0) {
      // Find ClientAdmin in the same organization
      const clientAdmin = await this.usersRepository.findOne({
        where: {
          org_id: orgId,
          role: 'ClientAdmin',
        },
      });

      if (clientAdmin) {
        // Reassign team members to ClientAdmin
        await this.usersRepository.update(
          { manager_id: managerId, org_id: orgId },
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
          { manager_id: managerId, org_id: orgId },
          { manager_id: null },
        );

        // Note: In a production system, you might want to throw an error or
        // prevent deletion until ClientAdmin is assigned to maintain data integrity
      }
    }

    return teamMembersCount;
  }

  /**
   * Send OTP to an email address or phone number
   * This endpoint can be used for various purposes (password reset, verification, etc.)
   */
  async sendOtp(email?: string, phone?: string): Promise<{ message: string }> {
    // Validate that at least one is provided
    if (!email && !phone) {
      throw new BadRequestException('Please provide either email or phone number');
    }

    // Generate OTP
    const otp = this.otpService.generateOtp();
    
    // If email is provided, send OTP via email
    if (email) {
      console.log('DEBUG: Generated OTP for email', email);
      
      // Check if user with this email already exists and is fully registered
      const existingUser = await this.usersRepository.findOne({
        where: { email },
      });

      // If user exists and has password_hash and name (complete user), throw error
      if (existingUser && existingUser.password_hash && existingUser.name) {
        throw new ConflictException(
          `This email is already registered and verified.`,
        );
      }
      
      // Store OTP in Redis
      await this.otpService.storeOtp(email, otp, 'register');
      console.log('DEBUG: OTP stored in Redis');
      
      // Send OTP via email
      await this.mailService.sendVerificationOtp(email, otp);
      console.log('DEBUG: OTP email sent');
      
      return {
        message: 'Success - please check your mail for OTP',
      };
    }
    
    // If phone is provided, send OTP via SMS
    if (!phone) {
      throw new BadRequestException('Phone number is required');
    }
    
    console.log('DEBUG: Generated OTP for phone', phone);
    
    // Store OTP in Redis
    await this.otpService.storeOtp(phone, otp, 'register');
    console.log('DEBUG: OTP stored in Redis');
    
    // Send OTP via SMS
    await this.mailService.sendSmsOtp(phone, otp);
    console.log('DEBUG: OTP SMS sent');
    
    return {
      message: 'Success - please check your phone for OTP',
    };
  }


}
