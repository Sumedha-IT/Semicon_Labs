import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
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
  ) {}

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  // ----------------------------------------------------------------------------
  // 1. ENROLLMENT OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Enroll a user in a module
   * Validates user access through domain assignments
   */
  async enroll(userId: number, enrollDto: EnrollModuleDto) {
    const { module_id } = enrollDto;

    // Validate module_id
    if (!module_id || module_id === null || module_id === undefined) {
      throw new ConflictException(
        'module_id is required and must be a valid number',
      );
    }

    // Validate user exists and is active
    await this.validateUserExistsAndActive(userId);

    // Validate module exists
    const module = await this.validateModuleExists(module_id);

    // Verify user has access through domain assignment
    await this.validateUserHasModuleAccess(userId, module_id);

    // Check if already enrolled
    const existingEnrollment = await this.userModuleRepository.findOne({
      where: { user_id: userId, module_id },
    });

    if (existingEnrollment) {
      return {
        message: 'User is already enrolled in this module',
        enrollment: this.mapEnrollmentToResponse(existingEnrollment),
      };
    }

    // Create enrollment with threshold_score from module
    const enrollment = this.userModuleRepository.create({
      user_id: userId,
      module_id,
      status: 'not_started',
      questions_answered: 0,
      score: 0,
      threshold_score: module.threshold_score,
    });

    const saved = await this.userModuleRepository.save(enrollment);

    return {
      message: 'Successfully enrolled in module',
      enrollment: this.mapEnrollmentToResponse(saved),
    };
  }

  /**
   * Unenroll user from module by enrollment ID
   */
  async unenroll(enrollmentId: number) {
    const enrollment = await this.userModuleRepository.findOne({
      where: { id: enrollmentId },
    });

    if (!enrollment) {
      throw new NotFoundException(
        `Enrollment with ID ${enrollmentId} not found`,
      );
    }

    // Validate user exists and is active
    await this.validateUserExistsAndActive(enrollment.user_id);

    await this.userModuleRepository.remove(enrollment);

    return {
      success: true,
      message: `User ${enrollment.user_id} unenrolled from module ${enrollment.module_id}`,
    };
  }

  /**
   * Unenroll user from module by user ID and module ID
   */
  async unenrollByUserAndModule(userId: number, moduleId: number) {
    // Validate user exists and is active
    await this.validateUserExistsAndActive(userId);

    const enrollment = await this.userModuleRepository.findOne({
      where: { user_id: userId, module_id: moduleId },
    });

    if (!enrollment) {
      throw new NotFoundException(
        `No enrollment found for user ${userId} in module ${moduleId}`,
      );
    }

    await this.userModuleRepository.remove(enrollment);

    return {
      success: true,
      message: `User ${userId} unenrolled from module ${moduleId}`,
    };
  }

  // ----------------------------------------------------------------------------
  // 2. QUERY OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Get all enrolled modules for a user with pagination
   */
  async getUserModules(userId: number, queryDto: UserModuleQueryDto) {
    const { page = 1, limit = 10, status, module_id } = queryDto;

    // Validate user exists and is active
    await this.validateUserExistsAndActive(userId);

    // Build where conditions
    const where: any = { user_id: userId };
    if (status) {
      where.status = status;
    }
    if (module_id) {
      where.module_id = module_id;
    }

    // Use entity objects with relations
    const [enrollments, total] = await this.userModuleRepository.findAndCount({
      where,
      relations: {
        module: {
          domainModules: {
            domain: true,
          },
        },
      },
      order: { joined_on: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Map to response format
    const data = enrollments.map((enrollment) => {
      const firstDomain = enrollment.module.domainModules[0]?.domain;
      return {
        id: enrollment.id,
        module_id: enrollment.module_id,
        module_title: enrollment.module.title,
        module_description: enrollment.module.desc,
        domain_name: firstDomain?.name || null,
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
   */
  async getUserModule(userId: number, moduleId: number) {
    // Validate user exists and is active
    await this.validateUserExistsAndActive(userId);

    // Use entity objects with relations instead of QueryBuilder
    const enrollment = await this.userModuleRepository.findOne({
      where: { user_id: userId, module_id: moduleId },
      relations: {
        module: {
          domainModules: {
            domain: true,
          },
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException(
        `No enrollment found for user ${userId} in module ${moduleId}`,
      );
    }

    // Get first domain name (modules can belong to multiple domains)
    const firstDomain = enrollment.module.domainModules[0]?.domain;

    return {
      id: enrollment.id,
      module_id: enrollment.module_id,
      module_title: enrollment.module.title,
      module_description: enrollment.module.desc,
      domain_name: firstDomain?.name || null,
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
   */
  async getAvailableModules(userId: number, queryDto: UserModuleQueryDto) {
    const { page = 1, limit = 10 } = queryDto;

    // Validate user exists and is active
    await this.validateUserExistsAndActive(userId);

    // Get modules from user's domains that aren't enrolled yet
    const queryBuilder = this.moduleRepository
      .createQueryBuilder('m')
      .innerJoin('domain_modules', 'dm', 'dm.module_id = m.id')
      .innerJoin('user_domains', 'ud', 'ud.domain_id = dm.domain_id')
      .innerJoin('domains', 'd', 'd.id = dm.domain_id')
      .leftJoin(
        'user_modules',
        'um',
        'um.module_id = m.id AND um.user_id = :userId',
        { userId },
      )
      .where('ud.user_id = :userId', { userId })
      .andWhere('um.id IS NULL'); // Not enrolled yet

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
  }

  /**
   * Find enrollment by ID (admin operation)
   */
  async findOneById(enrollmentId: number) {
    // Use entity objects with relations
    const enrollment = await this.userModuleRepository.findOne({
      where: { id: enrollmentId },
      relations: {
        user: true,
        module: {
          domainModules: {
            domain: true,
          },
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException(
        `Enrollment with ID ${enrollmentId} not found`,
      );
    }

    // Check if user was deleted
    if (enrollment.user.deleted_on) {
      throw new NotFoundException(
        `Enrollment with ID ${enrollmentId} not found or user has been deleted`,
      );
    }

    // Get first domain name
    const firstDomain = enrollment.module.domainModules[0]?.domain;

    return {
      id: enrollment.id,
      user_id: enrollment.user_id,
      user_name: enrollment.user.name,
      user_email: enrollment.user.email,
      module_id: enrollment.module_id,
      module_title: enrollment.module.title,
      module_description: enrollment.module.desc,
      domain_name: firstDomain?.name || null,
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
    const { page = 1, limit = 10, status, module_id, user_id } = queryDto;

    // Build where conditions
    const where: any = {};
    if (user_id) {
      where.user_id = user_id;
    }
    if (module_id) {
      where.module_id = module_id;
    }
    if (status) {
      where.status = status;
    }

    // Use entity objects with relations and filter deleted users
    const [enrollments, total] = await this.userModuleRepository.findAndCount({
      where,
      relations: {
        user: true,
        module: {
          domainModules: {
            domain: true,
          },
        },
      },
      order: { joined_on: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Filter out deleted users and map to response format
    const data = enrollments
      .filter((enrollment) => !enrollment.user.deleted_on)
      .map((enrollment) => {
        const firstDomain = enrollment.module.domainModules[0]?.domain;
        return {
          id: enrollment.id,
          user_id: enrollment.user_id,
          user_name: enrollment.user.name,
          user_email: enrollment.user.email,
          module_id: enrollment.module_id,
          module_title: enrollment.module.title,
          domain_name: firstDomain?.name || null,
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
      total: data.length, // Adjust total after filtering
      page,
      limit,
      totalPages: Math.ceil(data.length / limit),
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
  ) {
    // Validate user exists and is active
    await this.validateUserExistsAndActive(userId);

    // Find the enrollment
    const enrollment = await this.userModuleRepository.findOne({
      where: { user_id: userId, module_id: moduleId },
    });

    if (!enrollment) {
      throw new NotFoundException(
        `No enrollment found for user ${userId} in module ${moduleId}`,
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
    });

    if (!enrollment) {
      throw new NotFoundException(
        `Enrollment with ID ${enrollmentId} not found`,
      );
    }

    // Validate user exists and is active
    await this.validateUserExistsAndActive(enrollment.user_id);

    // Apply updates using helper
    this.applyEnrollmentUpdates(enrollment, updateDto);

    const updated = await this.userModuleRepository.save(enrollment);

    return {
      message: 'User module updated successfully',
      data: {
        ...this.mapEnrollmentToDetailedResponse(updated),
        user_id: updated.user_id,
      },
    };
  }

  // ----------------------------------------------------------------------------
  // 4. CLEANUP OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Cleanup all module enrollments for a user (used when deleting a user)
   * Does not validate if user exists since it's called during deletion
   */
  async cleanupUserModules(userId: number): Promise<number> {
    const enrollments = await this.userModuleRepository.find({
      where: { user_id: userId },
    });

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
      where: { user_id: userId, deleted_on: IsNull() },
    });

    if (!user) {
      // Check if user exists but is soft deleted
      const deletedUser = await this.userRepository.findOne({
        where: { user_id: userId },
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
   * Validates that a user has access to a module through domain assignment
   * User must be assigned to at least one of the module's domains
   * @throws ForbiddenException if user doesn't have access
   */
  private async validateUserHasModuleAccess(
    userId: number,
    moduleId: number,
  ): Promise<void> {
    const hasAccess = await this.userDomainRepository
      .createQueryBuilder('ud')
      .innerJoin('domain_modules', 'dm', 'dm.domain_id = ud.domain_id')
      .where('ud.user_id = :userId', { userId })
      .andWhere('dm.module_id = :moduleId', { moduleId })
      .getOne();

    if (!hasAccess) {
      throw new ForbiddenException(
        `User does not have access to this module. User must be assigned to at least one of the module's domains first.`,
      );
    }
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
    if (updateDto.questions_answered !== undefined) {
      enrollment.questions_answered = updateDto.questions_answered;
    }

    if (updateDto.score !== undefined) {
      enrollment.score = updateDto.score;
    }

    if (updateDto.threshold_score !== undefined) {
      enrollment.threshold_score = updateDto.threshold_score;
    }

    // Auto-update status based on score vs threshold
    if (updateDto.score !== undefined) {
      const finalScore = updateDto.score;
      const threshold =
        updateDto.threshold_score !== undefined
          ? updateDto.threshold_score
          : enrollment.threshold_score;

      if (finalScore >= threshold) {
        enrollment.status = 'passed';
        enrollment.completed_on = new Date();
      } else {
        enrollment.status = 'failed';
        enrollment.completed_on = new Date();
      }
    } else if (updateDto.status !== undefined) {
      // Allow manual status override
      enrollment.status = updateDto.status;

      // Set completed_on timestamp if status is final
      if (
        ['completed', 'passed', 'failed'].includes(updateDto.status) &&
        !enrollment.completed_on
      ) {
        enrollment.completed_on = new Date();
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
