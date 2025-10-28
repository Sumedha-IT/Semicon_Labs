import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpStatus,
  HttpCode,
  BadRequestException,
  Res,
  Inject,
  forwardRef,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Response } from 'express';
import { UsersService } from './users.service';
import { UserQueryDto } from './dto/user-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorator/roles.decorator';
import { UserRole } from '../common/constants/user-roles';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { Public } from '../common/decorator/public.decorator';
import { validateUserFieldAuthorization } from '../common/utils/field-authorization.helper';
import { UserModule } from '../user-modules/entities/user-module.entity';
import { UserDomain } from '../user-domains/entities/user-domain.entity';
import { User } from './entities/user.entity';
import { ModulesService } from '../modules/modules.service';
import {
  UpdateUserModuleDto,
  EnrollModuleDto,
} from '../user-modules/dto/user-module.dto';

@Controller({ path: 'users', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersV1Controller {
  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(UserModule)
    private userModuleRepository: Repository<UserModule>,
    @InjectRepository(UserDomain)
    private userDomainRepository: Repository<UserDomain>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(forwardRef(() => ModulesService))
    private readonly modulesService: ModulesService,
  ) {}

  // Universal registration endpoint
  // Public for individual learners (org_id not provided or null)
  // Requires authentication for organizational users (org_id provided)
  // Allows Platform Admin creation through public registration
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() createUserDto: CreateUserDto) {
    // Allow Platform Admin creation through public registration
    if (createUserDto.role === UserRole.PLATFORM_ADMIN) {
      const user = await this.usersService.create(createUserDto);
      return { id: user.id };
    }

    // If no org_id provided or org_id is null, treat as individual learner registration
    if (!createUserDto.org_id) {
      // Force individual learner fields
      const individualUserData = {
        ...createUserDto,
        org_id: null as any,
        manager_id: null as any,
        role: UserRole.LEARNER,
      };
      // Use registerWithOtp to send OTP
      return await this.usersService.registerWithOtp(individualUserData);
    }

    // For organizational users (org_id provided), create with OTP
    return await this.usersService.registerWithOtp(createUserDto);
  }

  /**
   * Send OTP to an email address or phone number
   * POST /api/v1/users/sendOtp
   */
  @Public()
  @Post('sendOtp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return await this.usersService.sendOtp(sendOtpDto.email, sendOtpDto.phone);
  }

  // Protected endpoint - Create users with role-based permissions:
  // - Platform Admin: Can create ClientAdmin, Manager, Learner (any organization)
  // - ClientAdmin: Can create Manager, Learner (only their own organization)
  @Post()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto, @Request() req) {
    const requestingUser = req.user;

    // If ClientAdmin is creating a user
    if (requestingUser.role === UserRole.CLIENT_ADMIN) {
      // ClientAdmin cannot create another ClientAdmin
      if (createUserDto.role === UserRole.CLIENT_ADMIN) {
        throw new BadRequestException(
          'ClientAdmin cannot create another ClientAdmin. Only Platform Admin can create ClientAdmin roles.',
        );
      }

      // ClientAdmin cannot create Platform Admin
      if (createUserDto.role === UserRole.PLATFORM_ADMIN) {
        throw new BadRequestException(
          'ClientAdmin cannot create Platform Admin.',
        );
      }

      // ClientAdmin can only create users in their own organization
      if (
        !createUserDto.org_id ||
        createUserDto.org_id !== requestingUser.orgId
      ) {
        throw new BadRequestException(
          `ClientAdmin can only create users in their own organization (org_id: ${requestingUser.orgId}).`,
        );
      }
    }

    const user = await this.usersService.create(createUserDto);
    return { id: user.id };
  }

  // Get all users with comprehensive pagination and filtering
  @Get()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  async findAll(
    @Query() queryDto: UserQueryDto,
    @Request() req,
    @Res() res: Response,
  ) {
    const result = await this.usersService.findUsersWithPaginationWithoutDetails(
      queryDto,
      req.user,
    );

    // Return 204 No Content if no data in response
    if (result.data.length === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    return res.status(HttpStatus.OK).json(result);
  }





  // Password management - self-change password
  // Users can change their own password (with current password)
  @Patch('password')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MANAGER,
    UserRole.LEARNER,
  )
  @HttpCode(HttpStatus.OK)
  changePassword(
    @Body() passwordData: { 
      currentPassword: string; 
      newPassword: string; 
    },
    @Request() req,
  ) {
    const requestingUser = req.user;
    
    if (!requestingUser.userId || isNaN(requestingUser.userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    
    if (!passwordData.currentPassword) {
      throw new BadRequestException('Current password is required');
    }
    
    return this.usersService.changePassword(
      requestingUser.userId,
      passwordData.currentPassword,
      passwordData.newPassword,
    );
  }


  // Individual learners list (admin only)
  // IMPORTANT: This must come BEFORE @Get(':id') to avoid route conflicts
  @Get('individualLearners')
  @Roles(UserRole.PLATFORM_ADMIN)
  getIndividualLearners() {
    return this.usersService.findIndividualLearners();
  }

  // Get user statistics
  @Get('stats')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  getUserStats(@Request() req) {
    return this.usersService.getUserStats(req.user);
  }

  // Get user statistics by role
  @Get('stats/role')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  getUserStatsByRole(@Request() req) {
    return this.usersService.getUserStatsByRole(req.user);
  }


  // ============================================================================
  // USER MODULE ENDPOINTS - User-centric API
  // ============================================================================

  // Enroll user in a module
  @Post(':id/modules/:moduleId/enroll')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MANAGER,
    UserRole.LEARNER,
  )
  @HttpCode(HttpStatus.CREATED)
  async enrollUserInModule(
    @Param('id') userId: string,
    @Param('moduleId') moduleId: string,
    @Query('domainId') domainIdQuery: string,
    @Body() body: any,
    @Request() req,
  ) {
    const userIdNum = parseInt(userId, 10);
    const modId = parseInt(moduleId, 10);
    
    if (isNaN(userIdNum) || isNaN(modId)) {
      throw new BadRequestException('Invalid user ID or module ID');
    }

    // Learners can only enroll themselves
    if (req.user.role === UserRole.LEARNER && req.user.userId !== userIdNum) {
      throw new BadRequestException(
        'Learners can only enroll themselves in modules',
      );
    }

    // Get domainId from query param or body (query takes precedence)
    let domainId: number | undefined;
    if (domainIdQuery) {
      domainId = parseInt(domainIdQuery, 10);
      if (isNaN(domainId)) {
        throw new BadRequestException('Invalid domain ID in query parameter');
      }
    } else if (body?.domainId) {
      domainId = parseInt(body.domainId, 10);
      if (isNaN(domainId)) {
        throw new BadRequestException('Invalid domain ID in request body');
      }
    }

    return this.processUserEnrollment(userIdNum, { moduleId: modId, domainId });
  }

  // Get user's enrollment in a specific module
  @Get(':id/modules/:moduleId')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MANAGER,
    UserRole.LEARNER,
  )
  async getUserModuleEnrollment(
    @Param('id') userId: string,
    @Param('moduleId') moduleId: string,
    @Query('domainId') domainIdQuery: string,
  ) {
    const userIdNum = parseInt(userId, 10);
    const modId = parseInt(moduleId, 10);
    
    if (isNaN(userIdNum) || isNaN(modId)) {
      throw new BadRequestException('Invalid user ID or module ID');
    }

    let domainId: number | undefined;
    if (domainIdQuery) {
      domainId = parseInt(domainIdQuery, 10);
      if (isNaN(domainId)) {
        throw new BadRequestException('Invalid domain ID');
      }
    }

    return this.getUserModule(userIdNum, modId, domainId);
  }

  // Update user's enrollment in a module
  @Patch(':id/modules/:moduleId')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async updateUserModuleEnrollment(
    @Param('id') userId: string,
    @Param('moduleId') moduleId: string,
    @Query('domainId') domainIdQuery: string,
    @Body() updateDto: UpdateUserModuleDto,
  ) {
    const userIdNum = parseInt(userId, 10);
    const modId = parseInt(moduleId, 10);
    
    if (isNaN(userIdNum) || isNaN(modId)) {
      throw new BadRequestException('Invalid user ID or module ID');
    }

    let domainId: number | undefined;
    if (domainIdQuery) {
      domainId = parseInt(domainIdQuery, 10);
      if (isNaN(domainId)) {
        throw new BadRequestException('Invalid domain ID');
      }
    }

    return this.updateUserModule(userIdNum, modId, updateDto, domainId);
  }

  // ============================================================================
  // PRIVATE HELPER METHODS (copied from ModulesController)
  // ============================================================================

  private async processUserEnrollment(userId: number, enrollDto: EnrollModuleDto) {
    try {
      const { moduleId, domainId } = enrollDto;

      // Validate moduleId
      if (!moduleId || moduleId === null || moduleId === undefined) {
        throw new BadRequestException(
          'moduleId is required and must be a valid number',
        );
      }

      // Validate user exists and is active
      await this.validateUserExistsAndActive(userId);

      // Validate module exists
      await this.validateModuleExists(moduleId);

      // Get or validate user_domain_id
      const userDomainId = await this.resolveUserDomainId(userId, moduleId, domainId);

      // Check if already enrolled in this domain-module combination
      const existingEnrollment = await this.userModuleRepository.findOne({
        where: { user_domain_id: userDomainId, module_id: moduleId },
        relations: { userDomain: { domain: true } },
      });

      if (existingEnrollment) {
        return {
          message: 'User is already enrolled in this module for this domain',
          enrollment: this.mapEnrollmentToResponse(existingEnrollment),
        };
      }

      // Create enrollment; threshold_score defaults in DB (70)
      const enrollment = this.userModuleRepository.create({
        user_domain_id: userDomainId,
        module_id: moduleId,
        status: 'todo',
        questions_answered: 0,
        score: 0,
      });

      const saved = await this.userModuleRepository.save(enrollment);

      return {
        message: 'Successfully enrolled in module',
        enrollment: this.mapEnrollmentToResponse(saved),
      };
    } catch (err) {
      console.error('Enroll error:', err);
      throw new BadRequestException('Unable to enroll user in module');
    }
  }

  private async getUserModule(userId: number, moduleId: number, domainId?: number) {
    // Validate user exists and is active
    await this.validateUserExistsAndActive(userId);

    // Build query with user_domain relationship
    const queryBuilder = this.userModuleRepository
      .createQueryBuilder('um')
      .innerJoinAndSelect('um.userDomain', 'ud')
      .innerJoinAndSelect('ud.domain', 'd')
      .innerJoinAndSelect('um.module', 'm')
      .where('ud.user_id = :userId', { userId })
      .andWhere('um.module_id = :moduleId', { moduleId });

    // Filter by domainId if provided
    if (domainId) {
      queryBuilder.andWhere('ud.domain_id = :domainId', { domainId });
    }

    const enrollment = await queryBuilder.getOne();

    if (!enrollment) {
      const domainMsg = domainId ? ` in domain ${domainId}` : '';
      throw new BadRequestException(
        `No enrollment found for user ${userId} in module ${moduleId}${domainMsg}`,
      );
    }

    return {
      id: enrollment.id,
      user_domain_id: enrollment.user_domain_id,
      module_id: enrollment.module_id,
      module_title: enrollment.module.title,
      module_description: enrollment.module.desc,
      domain_id: enrollment.userDomain.domain_id,
      domain_name: enrollment.userDomain.domain.name,
      questions_answered: enrollment.questions_answered,
      score: enrollment.score,
      threshold_score: enrollment.threshold_score,
      status: enrollment.status,
      joined_on: enrollment.joined_on,
      completed_on: enrollment.completed_on,
      passed: enrollment.score >= enrollment.threshold_score,
    };
  }

  private async updateUserModule(
    userId: number,
    moduleId: number,
    updateDto: UpdateUserModuleDto,
    domainId?: number,
  ) {
    // Validate user exists and is active
    await this.validateUserExistsAndActive(userId);

    // Find the enrollment with user_domain relationship
    const queryBuilder = this.userModuleRepository
      .createQueryBuilder('um')
      .innerJoinAndSelect('um.userDomain', 'ud')
      .where('ud.user_id = :userId', { userId })
      .andWhere('um.module_id = :moduleId', { moduleId });

    // Filter by domainId if provided
    if (domainId) {
      queryBuilder.andWhere('ud.domain_id = :domainId', { domainId });
    }

    const enrollment = await queryBuilder.getOne();

    if (!enrollment) {
      const domainMsg = domainId ? ` in domain ${domainId}` : '';
      throw new BadRequestException(
        `No enrollment found for user ${userId} in module ${moduleId}${domainMsg}`,
      );
    }

    // Apply updates using helper
    this.applyEnrollmentUpdates(enrollment, updateDto);

    const updated = await this.userModuleRepository.save(enrollment);

    return {
      message: 'User module updated successfully',
      data: this.mapEnrollmentToDetailedResponse(updated),
    };
  }

  // Helper methods
  private async validateUserExistsAndActive(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId, deleted_on: IsNull() },
    });

    if (!user) {
      const deletedUser = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (deletedUser && deletedUser.deleted_on) {
        throw new BadRequestException(`User with ID ${userId} has been deleted`);
      } else {
        throw new BadRequestException(`User with ID ${userId} not found`);
      }
    }

    return user;
  }

  private async validateModuleExists(moduleId: number) {
    const module = await this.modulesService.findOne(moduleId);
    if (!module) {
      throw new BadRequestException(`Module with ID ${moduleId} not found`);
    }
    return module;
  }

  private async resolveUserDomainId(
    userId: number,
    moduleId: number,
    domainId?: number,
  ): Promise<number> {
    // Find all user_domains where user has access to this module
    const userDomains = await this.userDomainRepository
      .createQueryBuilder('ud')
      .innerJoin('domain_modules', 'dm', 'dm.domain_id = ud.domain_id')
      .where('ud.user_id = :userId', { userId })
      .andWhere('dm.module_id = :moduleId', { moduleId })
      .getMany();

    if (userDomains.length === 0) {
      throw new BadRequestException(
        `User does not have access to this module. User must be assigned to at least one of the module's domains first.`,
      );
    }

    // If domainId specified, validate and return that specific user_domain
    if (domainId) {
      const userDomain = userDomains.find((ud) => ud.domain_id === domainId);
      if (!userDomain) {
        throw new BadRequestException(
          `User does not have access to module in domain ${domainId}.`,
        );
      }
      return userDomain.id;
    }

    // If module available in multiple domains, require domainId to be specified
    if (userDomains.length > 1) {
      throw new BadRequestException(
        `Module is available in multiple domains. Please specify domainId parameter. Available domains: ${userDomains.map((ud) => ud.domain_id).join(', ')}`,
      );
    }

    // Auto-select the only available domain
    return userDomains[0].id;
  }

  private applyEnrollmentUpdates(
    enrollment: UserModule,
    updateDto: UpdateUserModuleDto,
  ): void {
    // Update basic fields
    if (updateDto.questionsAnswered !== undefined) {
      enrollment.questions_answered = updateDto.questionsAnswered;
    }

    if (updateDto.score !== undefined) {
      enrollment.score = updateDto.score;
    }

    if (updateDto.thresholdScore !== undefined) {
      enrollment.threshold_score = updateDto.thresholdScore;
    }

    // Auto-update status based on score vs threshold
    if (updateDto.score !== undefined) {
      const finalScore = updateDto.score;
      const threshold =
        updateDto.thresholdScore !== undefined
          ? updateDto.thresholdScore
          : enrollment.threshold_score;

      if (finalScore >= threshold) {
        // User passed - mark as completed
        enrollment.status = 'completed';
        enrollment.completed_on = new Date();
      } else {
        // User failed - keep in progress so they can retry
        enrollment.status = 'inProgress';
        enrollment.completed_on = null; // Clear completed timestamp
      }
    } else if (updateDto.status !== undefined) {
      // Allow manual status override
      enrollment.status = updateDto.status;

      // Set completed_on timestamp if status is completed
      if (updateDto.status === 'completed' && !enrollment.completed_on) {
        enrollment.completed_on = new Date();
      } else if (updateDto.status !== 'completed') {
        // Clear completed_on if status is changed back to todo or inProgress
        enrollment.completed_on = null;
      }
    }
  }

  private mapEnrollmentToResponse(enrollment: UserModule) {
    return {
      id: enrollment.id,
      module_id: enrollment.module_id,
      status: enrollment.status,
      threshold_score: enrollment.threshold_score,
      joined_on: enrollment.joined_on,
    };
  }

  private mapEnrollmentToDetailedResponse(enrollment: UserModule) {
    return {
      id: enrollment.id,
      module_id: enrollment.module_id,
      questions_answered: enrollment.questions_answered,
      score: enrollment.score,
      threshold_score: enrollment.threshold_score,
      status: enrollment.status,
      passed: enrollment.score >= enrollment.threshold_score,
      joined_on: enrollment.joined_on,
      completed_on: enrollment.completed_on,
    };
  }

  // Get one user by id
  // IMPORTANT: Parameterized routes like :id MUST come AFTER all specific routes
  @Get(':id')
  @Roles(UserRole.PLATFORM_ADMIN)
  findOne(@Param('id') id: string) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    return this.usersService.findOne(userId);
  }

  // Update user by id
  // - Platform Admin: Can update any user in any organization
  // - ClientAdmin: Can update Manager, Learner in their own organization only
  @Patch(':id')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.LEARNER)
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req,
  ) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const requestingUser = req.user;

    // Learner and Manager can only update their own profile
    if ((requestingUser.role === UserRole.LEARNER || requestingUser.role === UserRole.MANAGER) && userId !== requestingUser.userId) {
      throw new ForbiddenException('Not authorized to update this user');
    }

    // Validate field-level authorization
    const isSelfUpdate = userId === requestingUser.userId;
    validateUserFieldAuthorization(
      updateUserDto,
      requestingUser.role,
      isSelfUpdate,
    );

    // If ClientAdmin is updating a user
    if (requestingUser.role === UserRole.CLIENT_ADMIN) {
      // Get the user being updated
      const userToUpdate = await this.usersService.findOne(userId);

      if (!userToUpdate) {
        throw new BadRequestException('User not found');
      }

      // ClientAdmin can only update users in their own organization
      if (userToUpdate.org_id !== requestingUser.orgId) {
        throw new BadRequestException(
          `ClientAdmin can only update users in their own organization (org_id: ${requestingUser.orgId}).`,
        );
      }

      // ClientAdmin cannot update ClientAdmin or Platform Admin
      if (
        userToUpdate.role === UserRole.CLIENT_ADMIN ||
        userToUpdate.role === UserRole.PLATFORM_ADMIN
      ) {
        throw new BadRequestException(
          `ClientAdmin cannot update ${userToUpdate.role} users.`,
        );
      }

      // ClientAdmin cannot change role to ClientAdmin or Platform Admin
      if (
        updateUserDto.role === UserRole.CLIENT_ADMIN ||
        updateUserDto.role === UserRole.PLATFORM_ADMIN
      ) {
        throw new BadRequestException(
          `ClientAdmin cannot update user role to ${updateUserDto.role}.`,
        );
      }

      // If updating org_id, ensure it's still their organization
      if (
        updateUserDto.org_id &&
        updateUserDto.org_id !== requestingUser.orgId
      ) {
        throw new BadRequestException(
          `ClientAdmin cannot move users to other organizations.`,
        );
      }
    }

    await this.usersService.update(userId, updateUserDto);
    return { user_id: userId };
  }


  // Delete user by id
  @Delete(':id')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @Request() req) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const requestingUser = req.user;

    // If ClientAdmin is deleting a user
    if (requestingUser.role === UserRole.CLIENT_ADMIN) {
      // Get the user being deleted
      const userToDelete = await this.usersService.findOne(userId);

      if (!userToDelete) {
        throw new BadRequestException('User not found');
      }

      // ClientAdmin can only delete users in their own organization
      if (userToDelete.org_id !== requestingUser.orgId) {
        throw new BadRequestException(
          `ClientAdmin can only delete users in their own organization (org_id: ${requestingUser.orgId}).`,
        );
      }

      // ClientAdmin cannot delete ClientAdmin or Platform Admin
      if (
        userToDelete.role === UserRole.CLIENT_ADMIN ||
        userToDelete.role === UserRole.PLATFORM_ADMIN
      ) {
        throw new BadRequestException(
          `ClientAdmin cannot delete ${userToDelete.role} users.`,
        );
      }
    }

    await this.usersService.remove(userId);
  }

  // Restore soft-deleted user
  @Patch(':id/restore')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  @HttpCode(HttpStatus.OK)
  async restore(@Param('id') id: string, @Request() req) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    
    const result = await this.usersService.restore(userId, req.user);
    if (!result.success) {
      throw new BadRequestException(result.message);
    }
    
    return result;
  }



}


