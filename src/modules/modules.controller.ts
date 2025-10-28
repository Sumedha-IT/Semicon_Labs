import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  Request,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Response } from 'express';
import { ModulesService } from './modules.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ModuleQueryDto } from './dto/module-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorator/roles.decorator';
import { GetUser } from '../common/decorator/get-user.decorator';
import { UserRole } from '../common/constants/user-roles';
import { UserModule } from '../user-modules/entities/user-module.entity';
import { UserDomain } from '../user-domains/entities/user-domain.entity';
import { User } from '../users/entities/user.entity';
import {
  UserModuleQueryDto,
  UpdateUserModuleDto,
  EnrollModuleDto,
} from '../user-modules/dto/user-module.dto';

@Controller({ path: 'modules', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class ModulesController {
  constructor(
    private readonly modulesService: ModulesService,
    @InjectRepository(UserModule)
    private userModuleRepository: Repository<UserModule>,
    @InjectRepository(UserDomain)
    private userDomainRepository: Repository<UserDomain>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  @Post()
  @Roles('PlatformAdmin')
  async create(@Body() createModuleDto: CreateModuleDto) {
    return await this.modulesService.create(createModuleDto);
  }

  @Get()
  @Roles('PlatformAdmin', 'ClientAdmin', 'Manager', 'Learner')
  async findAll(@Query() query: ModuleQueryDto, @Res() res: Response) {
    const result = await this.modulesService.findAll(query);

    // Return 204 No Content if no data in response
    if (result.data.length === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    return res.status(HttpStatus.OK).json(result);
  }

  @Get(':id')
  @Roles('PlatformAdmin', 'ClientAdmin', 'Manager', 'Learner')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.modulesService.findOne(id);
  }

  @Patch(':id')
  @Roles('PlatformAdmin')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateModuleDto: UpdateModuleDto,
    @GetUser('userId') userId: number,
  ) {
    return await this.modulesService.update(id, updateModuleDto, userId);
  }

  // Note: Module deletion is not supported as modules are core entities
  // that should not be removed once created

  // ============================================================================
  // USER-MODULE RELATIONSHIP ENDPOINTS
  // ============================================================================

  // Admin endpoint to get all user-module relationships with filters
  @Get('enroll')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  async getAllUserModules(
    @Query() queryDto: UserModuleQueryDto,
    @Res() res: Response,
  ) {
    const result = await this.findAllEnrollments(queryDto);

    // Return 204 No Content if no data in response
    if (result.data.length === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    return res.status(HttpStatus.OK).json(result);
  }

  // Enroll user in a module
  @Post(':id/enroll/:userId')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MANAGER,
    UserRole.LEARNER,
  )
  @HttpCode(HttpStatus.CREATED)
  async enrollUserInModule(
    @Param('id') moduleId: string,
    @Param('userId') userId: string,
    @Query('domainId') domainIdQuery: string,
    @Body() body: any,
    @Request() req,
  ) {
    const modId = parseInt(moduleId, 10);
    const userIdNum = parseInt(userId, 10);
    if (isNaN(modId) || isNaN(userIdNum)) {
      throw new BadRequestException('Invalid module ID or user ID');
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
  @Get(':id/enroll/:userId')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MANAGER,
    UserRole.LEARNER,
  )
  async getUserModuleEnrollment(
    @Param('id') moduleId: string,
    @Param('userId') userId: string,
    @Query('domainId') domainIdQuery: string,
  ) {
    const modId = parseInt(moduleId, 10);
    const userIdNum = parseInt(userId, 10);
    if (isNaN(modId) || isNaN(userIdNum)) {
      throw new BadRequestException('Invalid module ID or user ID');
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

  // Get all users enrolled in a specific module
  @Get(':id/enroll')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MANAGER,
    UserRole.LEARNER,
  )
  async getModuleEnrollments(
    @Param('id') moduleId: string,
    @Query() queryDto: UserModuleQueryDto,
    @Request() req,
    @Res() res: Response,
  ) {
    const modId = parseInt(moduleId, 10);
    if (isNaN(modId)) {
      throw new BadRequestException('Invalid module ID');
    }

    const result = await this.fetchModuleEnrollments(
      modId,
      queryDto,
    );

    // Return 204 No Content if no data in response
    if (result.data.length === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    return res.status(HttpStatus.OK).json(result);
  }

  // Update user's enrollment in a module
  @Patch(':id/enroll/:userId')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async updateUserModuleEnrollment(
    @Param('id') moduleId: string,
    @Param('userId') userId: string,
    @Query('domainId') domainIdQuery: string,
    @Body() updateDto: UpdateUserModuleDto,
  ) {
    const modId = parseInt(moduleId, 10);
    const userIdNum = parseInt(userId, 10);
    if (isNaN(modId) || isNaN(userIdNum)) {
      throw new BadRequestException('Invalid module ID or user ID');
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
  // PRIVATE METHODS (moved from UserModulesService)
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

  private async findAllEnrollments(queryDto: UserModuleQueryDto) {
    const { page = 1, limit = 10, status, moduleId, userId, domainId } = queryDto;

    // Build query with user_domain relationships
    const queryBuilder = this.userModuleRepository
      .createQueryBuilder('um')
      .innerJoinAndSelect('um.userDomain', 'ud')
      .innerJoinAndSelect('ud.user', 'u')
      .innerJoinAndSelect('ud.domain', 'd')
      .innerJoinAndSelect('um.module', 'm')
      .where('u.deleted_on IS NULL'); // Only include active users

    // Apply filters
    if (userId) {
      queryBuilder.andWhere('ud.user_id = :userId', { userId });
    }
    if (moduleId) {
      queryBuilder.andWhere('um.module_id = :moduleId', { moduleId });
    }
    if (domainId) {
      queryBuilder.andWhere('ud.domain_id = :domainId', { domainId });
    }
    if (status) {
      queryBuilder.andWhere('um.status = :status', { status });
    }

    // Get total
    const total = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder
      .orderBy('um.joined_on', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const enrollments = await queryBuilder.getMany();

    // Map to response format
    const data = enrollments.map((enrollment) => {
      return {
        id: enrollment.id,
        user_domain_id: enrollment.user_domain_id,
        user_id: enrollment.userDomain.user_id,
        user_name: enrollment.userDomain.user.name,
        user_email: enrollment.userDomain.user.email,
        domain_id: enrollment.userDomain.domain_id,
        domain_name: enrollment.userDomain.domain.name,
        module_id: enrollment.module_id,
        module_title: enrollment.module.title,
        questions_answered: enrollment.questions_answered,
        score: enrollment.score,
        threshold_score: enrollment.threshold_score,
        status: enrollment.status,
        joined_on: enrollment.joined_on,
        completed_on: enrollment.completed_on,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async fetchModuleEnrollments(moduleId: number, queryDto: any) {
    const { page = 1, limit = 10, status, scoreMin, scoreMax } = queryDto;

    const queryBuilder = this.userModuleRepository
      .createQueryBuilder('um')
      .innerJoin('um.userDomain', 'ud')
      .innerJoin('ud.user', 'u')
      .innerJoin('um.module', 'm')
      .where('um.module_id = :moduleId', { moduleId })
      .andWhere('u.deleted_on IS NULL'); // Only active users

    // Apply filters
    if (status) {
      if (status === 'passed') {
        queryBuilder
          .andWhere('um.status = :status', { status: 'completed' })
          .andWhere('um.score >= :minScore', { minScore: 70 });
      } else if (status === 'failed') {
        queryBuilder.andWhere('(um.status = :status OR um.score < :minScore)', {
          status: 'completed',
          minScore: 70,
        });
      } else {
        queryBuilder.andWhere('um.status = :status', { status });
      }
    }

    if (scoreMin !== undefined) {
      queryBuilder.andWhere('um.score >= :scoreMin', { scoreMin });
    }

    if (scoreMax !== undefined) {
      queryBuilder.andWhere('um.score <= :scoreMax', { scoreMax });
    }

    // Select fields
    queryBuilder.select([
      'um.id AS id',
      'um.user_domain_id AS user_domain_id',
      'ud.user_id AS user_id',
      'u.name AS user_name',
      'u.email AS user_email',
      'um.score AS score',
      'um.status AS status',
      'um.joined_on AS joined_on',
      'um.completed_on AS completed_on',
    ]);

    // Pagination
    queryBuilder
      .orderBy('um.joined_on', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [results, total] = await Promise.all([
      queryBuilder.getRawMany(),
      queryBuilder.getCount(),
    ]);

    return {
      data: results,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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
}
