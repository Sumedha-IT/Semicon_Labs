import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { UserModule } from './entities/user-module.entity';
import { User } from '../users/entities/user.entity';
import { Module } from '../modules/entities/module.entity';
import { UserDomain } from '../user-domains/entities/user-domain.entity';
import {
  EnrollModuleDto,
  UpdateUserModuleDto,
  UserModuleQueryDto,
} from './dto/user-module.dto';
import { UserTopicsService } from '../user-topics/user-topics.service';

@Injectable()
export class UserModulesService {
  constructor(
    @InjectRepository(UserModule)
    private userModuleRepository: Repository<UserModule>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Module)
    private moduleRepository: Repository<Module>,
    @InjectRepository(UserDomain)
    private userDomainRepository: Repository<UserDomain>,
    @Inject(forwardRef(() => UserTopicsService))
    private userTopicsService: UserTopicsService,
  ) {}

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  // ----------------------------------------------------------------------------
  // 1. ENROLLMENT OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Enroll a user in a module
   * Uses user_domain_id to enforce access and provide clear context
   * Auto-detects domain if not provided (when module belongs to only one of user's domains)
   */
  async enroll(userId: number, enrollDto: EnrollModuleDto) {
    try {
      const { moduleId, domainId } = enrollDto;

      // Validate moduleId
      if (!moduleId || moduleId === null || moduleId === undefined) {
        throw new ConflictException(
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
      // Never leak internal errors
      console.error('Enroll error:', err);
      throw new BadRequestException('Unable to enroll user in module');
    }
  }

  /**
   * Unenroll user from module by enrollment ID
   */
  async unenroll(enrollmentId: number) {
    const enrollment = await this.userModuleRepository.findOne({
      where: { id: enrollmentId },
      relations: { userDomain: true },
    });

    if (!enrollment) {
      throw new NotFoundException(
        `Enrollment with ID ${enrollmentId} not found`,
      );
    }

    const userId = enrollment.userDomain.user_id;

    // Validate user exists and is active
    await this.validateUserExistsAndActive(userId);

    // Cleanup topic assignments from this module
    await this.userTopicsService.cleanupTopicsForModule(
      userId,
      enrollment.module_id,
    );

    await this.userModuleRepository.remove(enrollment);

    return {
      success: true,
      message: `User ${userId} unenrolled from module ${enrollment.module_id}`,
    };
  }

  /**
   * Unenroll user from module by user ID and module ID
   * If user has multiple enrollments (different domains), unenrolls from all
   */
  async unenrollByUserAndModule(userId: number, moduleId: number, domainId?: number) {
    // Validate user exists and is active
    await this.validateUserExistsAndActive(userId);

    // Find all enrollments for this user-module combination
    const queryBuilder = this.userModuleRepository
      .createQueryBuilder('um')
      .innerJoinAndSelect('um.userDomain', 'ud')
      .where('ud.user_id = :userId', { userId })
      .andWhere('um.module_id = :moduleId', { moduleId });

    // If domainId specified, only unenroll from that specific domain
    if (domainId) {
      queryBuilder.andWhere('ud.domain_id = :domainId', { domainId });
    }

    const enrollments = await queryBuilder.getMany();

    if (enrollments.length === 0) {
      const domainMsg = domainId ? ` in domain ${domainId}` : '';
      throw new NotFoundException(
        `No enrollment found for user ${userId} in module ${moduleId}${domainMsg}`,
      );
    }

    // Cleanup topic assignments from this module
    await this.userTopicsService.cleanupTopicsForModule(userId, moduleId);

    await this.userModuleRepository.remove(enrollments);

    const domainMsg = domainId ? ` (domain ${domainId})` : ` (${enrollments.length} enrollment(s))`;
    return {
      success: true,
      message: `User ${userId} unenrolled from module ${moduleId}${domainMsg}`,
    };
  }

  // ----------------------------------------------------------------------------
  // 2. QUERY OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Get modules for a user with pagination
   * If enroll=false: returns available modules from user's domains (not yet enrolled)
   * If enroll=true or undefined: returns enrolled modules (default behavior)
   * Optional domain_id filter applies to both cases
   */
  async getUserModules(userId: number, queryDto: UserModuleQueryDto) {
    const { page = 1, limit = 10, status, moduleId, enroll, domainId } = queryDto;

    // Validate user exists and is active
    await this.validateUserExistsAndActive(userId);

    // If enroll=false (explicitly), return available modules from user's domains
    if (enroll === false) {
      return this.getAvailableModulesInternal(userId, page, limit, domainId);
    }

    // Default: return enrolled modules (if enroll=true or undefined)
    // Build query with user_domain_id
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
    if (moduleId) {
      queryBuilder.andWhere('um.module_id = :moduleId', { moduleId });
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
    const data = enrollments.map((enrollment) => {
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

  /**
   * Get user module enrollment details for a specific module
   * If user has multiple enrollments (different domains), returns the first one
   * or filters by optional domainId parameter
   */
  async getUserModule(userId: number, moduleId: number, domainId?: number) {
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
      throw new NotFoundException(
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

  /**
   * Get available modules (from user's domains) that user hasn't enrolled in yet
   * Modules that belong to at least one of the user's assigned domains
   * @deprecated Use getUserModules with enroll=false instead
   */
  async getAvailableModules(userId: number, queryDto: UserModuleQueryDto) {
    const { page = 1, limit = 10, domainId } = queryDto;
    await this.validateUserExistsAndActive(userId);
    return this.getAvailableModulesInternal(userId, page, limit, domainId);
  }

  /**
   * Internal method: Get available modules from user's domains (not enrolled yet)
   * Can optionally filter by specific domainId
   * Checks user_domain_id to see if already enrolled
   */
  private async getAvailableModulesInternal(
    userId: number,
    page: number,
    limit: number,
    domainId?: number,
  ) {
    try {
      // First check if user has any domains linked
      const userDomainsCount = await this.userDomainRepository.count({
        where: { user_id: userId },
      });

      if (userDomainsCount === 0) {
        // User has no domains linked, return empty result
        return {
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }

      // Get modules from user's domains that aren't enrolled yet
      const queryBuilder = this.moduleRepository
        .createQueryBuilder('m')
        .innerJoin('domain_modules', 'dm', 'dm.module_id = m.id')
        .innerJoin('user_domains', 'ud', 'ud.domain_id = dm.domain_id')
        .innerJoin('domains', 'd', 'd.id = dm.domain_id')
        .leftJoin(
          'user_modules',
          'um',
          'um.module_id = m.id AND um.user_domain_id = ud.id',
        )
        .where('ud.user_id = :userId', { userId })
        .andWhere('um.id IS NULL'); // Not enrolled yet in this user_domain context

      // Apply domain filter if provided
      if (domainId) {
        queryBuilder.andWhere('dm.domain_id = :domainId', { domainId });
      }

      // Get count (distinct modules)
      const totalQuery = queryBuilder.clone();
      const totalResult = await totalQuery
        .select('COUNT(DISTINCT m.id)', 'total')
        .getRawOne();
      const total = parseInt(totalResult?.total || 0);

      // Apply select and pagination (with distinct modules and aggregated domains)
      queryBuilder
        .select([
          'm.id AS id',
          'm.title AS title',
          'm.desc AS description',
          'm.duration AS duration',
          'm.level AS level',
          `STRING_AGG(DISTINCT d.name, ', ' ORDER BY d.name) AS domain_names`,
        ])
        .groupBy('m.id, m.title, m.desc, m.duration, m.level')
        .orderBy('m.created_on', 'DESC')
        .offset((page - 1) * limit)
        .limit(limit);

      const results = await queryBuilder.getRawMany();

      return {
        data: results,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      // Defensive: never bubble internal errors for this read path
      console.error('getAvailableModulesInternal error:', error);
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }
  }

  /**
   * Find enrollment by ID (admin operation)
   */
  async findOneById(enrollmentId: number) {
    // Use entity objects with relations
    const enrollment = await this.userModuleRepository.findOne({
      where: { id: enrollmentId },
      relations: {
        userDomain: {
          user: true,
          domain: true,
        },
        module: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundException(
        `Enrollment with ID ${enrollmentId} not found`,
      );
    }

    // Check if user was deleted
    if (enrollment.userDomain.user.deleted_on) {
      throw new NotFoundException(
        `Enrollment with ID ${enrollmentId} not found or user has been deleted`,
      );
    }

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
      module_description: enrollment.module.desc,
      questions_answered: enrollment.questions_answered,
      score: enrollment.score,
      threshold_score: enrollment.threshold_score,
      status: enrollment.status,
      joined_on: enrollment.joined_on,
      completed_on: enrollment.completed_on,
      passed: enrollment.score >= enrollment.threshold_score,
    };
  }

  /**
   * Find all enrollments with filters (admin operation)
   */
  async findAllEnrollments(queryDto: UserModuleQueryDto) {
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

  // ----------------------------------------------------------------------------
  // 3. UPDATE OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Update user module enrollment (questions_answered, score, status)
   */
  async updateUserModule(
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
      throw new NotFoundException(
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

  /**
   * Update enrollment by ID (admin operation)
   */
  async updateById(enrollmentId: number, updateDto: UpdateUserModuleDto) {
    // Find the enrollment
    const enrollment = await this.userModuleRepository.findOne({
      where: { id: enrollmentId },
      relations: { userDomain: true },
    });

    if (!enrollment) {
      throw new NotFoundException(
        `Enrollment with ID ${enrollmentId} not found`,
      );
    }

    const userId = enrollment.userDomain.user_id;

    // Validate user exists and is active
    await this.validateUserExistsAndActive(userId);

    // Apply updates using helper
    this.applyEnrollmentUpdates(enrollment, updateDto);

    const updated = await this.userModuleRepository.save(enrollment);

    return {
      message: 'User module updated successfully',
      data: {
        ...this.mapEnrollmentToDetailedResponse(updated),
        user_domain_id: updated.user_domain_id,
        user_id: userId,
      },
    };
  }

  // ----------------------------------------------------------------------------
  // 4. CLEANUP OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Cleanup all module enrollments for a user (used when deleting a user)
   * Does not validate if user exists since it's called during deletion
   * Finds enrollments through user_domain relationships
   */
  async cleanupUserModules(userId: number): Promise<number> {
    const enrollments = await this.userModuleRepository
      .createQueryBuilder('um')
      .innerJoin('um.userDomain', 'ud')
      .where('ud.user_id = :userId', { userId })
      .getMany();

    if (enrollments.length > 0) {
      await this.userModuleRepository.remove(enrollments);
      console.log(
        `Cleaned up ${enrollments.length} module enrollment(s) for user ${userId}`,
      );
    }

    return enrollments.length;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  // ----------------------------------------------------------------------------
  // Validation Helpers
  // ----------------------------------------------------------------------------

  /**
   * Validates that a user exists and is active (not soft deleted)
   * @throws NotFoundException if user doesn't exist or is deleted
   */
  private async validateUserExistsAndActive(userId: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId, deleted_on: IsNull() },
    });

    if (!user) {
      // Check if user exists but is soft deleted
      const deletedUser = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (deletedUser && deletedUser.deleted_on) {
        throw new NotFoundException(`User with ID ${userId} has been deleted`);
      } else {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }
    }

    return user;
  }

  /**
   * Validates that a module exists
   * @throws NotFoundException if module doesn't exist
   */
  private async validateModuleExists(moduleId: number): Promise<Module> {
    const module = await this.moduleRepository.findOne({
      where: { id: moduleId },
    });

    if (!module) {
      throw new NotFoundException(`Module with ID ${moduleId} not found`);
    }

    return module;
  }

  /**
   * Resolves the user_domain_id to use for module enrollment
   * If domainId is provided, validates and returns that user_domain record
   * If not provided, auto-detects if module belongs to only one of user's domains
   * @throws ForbiddenException if user doesn't have access to the module
   * @throws BadRequestException if domainId is required but not provided
   */
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
      throw new ForbiddenException(
        `User does not have access to this module. User must be assigned to at least one of the module's domains first.`,
      );
    }

    // If domainId specified, validate and return that specific user_domain
    if (domainId) {
      const userDomain = userDomains.find((ud) => ud.domain_id === domainId);
      if (!userDomain) {
        throw new ForbiddenException(
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

  // ----------------------------------------------------------------------------
  // Update Helpers
  // ----------------------------------------------------------------------------

  /**
   * Applies updates to an enrollment entity
   * Handles score, questions_answered, threshold_score, and status updates
   * Auto-updates status based on score vs threshold
   */
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

  // ----------------------------------------------------------------------------
  // Response Mapping Helpers
  // ----------------------------------------------------------------------------

  /**
   * Maps enrollment entity to basic response object
   */
  private mapEnrollmentToResponse(enrollment: UserModule) {
    return {
      id: enrollment.id,
      module_id: enrollment.module_id,
      status: enrollment.status,
      threshold_score: enrollment.threshold_score,
      joined_on: enrollment.joined_on,
    };
  }

  /**
   * Maps enrollment entity to detailed response object
   */
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
