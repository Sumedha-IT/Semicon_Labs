import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { UserTopic } from './entities/user-topic.entity';
import { User } from '../users/entities/user.entity';
import { Topic } from '../topics/entities/topic.entity';
import { UserModule } from '../user-modules/entities/user-module.entity';
import { ModuleTopic } from '../module_topics/entities/module-topic.entity';
import { UserTopicQueryDto } from './dto/user-topic-query.dto';
import { UpdateUserTopicDto } from './dto/update-user-topic.dto';

@Injectable()
export class UserTopicsService {
  constructor(
    @InjectRepository(UserTopic)
    private userTopicRepository: Repository<UserTopic>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Topic)
    private topicRepository: Repository<Topic>,
    @InjectRepository(UserModule)
    private userModuleRepository: Repository<UserModule>,
    @InjectRepository(ModuleTopic)
    private moduleTopicRepository: Repository<ModuleTopic>,
  ) {}

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  // ----------------------------------------------------------------------------
  // 1. ASSIGNMENT OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Assign a topic to a user
   * Validates user has access through module enrollment
   */
  async assignTopic(userId: number, topicId: number) {
    // Validate user exists and is active
    await this.validateUserExistsAndActive(userId);

    // Validate topic exists
    const topic = await this.validateTopicExists(topicId);

    // Verify user has access through module enrollment
    await this.validateUserHasTopicAccess(userId, topicId);

    // Check if already assigned
    const existingAssignment = await this.userTopicRepository.findOne({
      where: { user_id: userId, topic_id: topicId },
    });

    if (existingAssignment) {
      throw new ConflictException(
        'User is already assigned to this topic',
      );
    }

    // Create assignment
    const assignment = this.userTopicRepository.create({
      user_id: userId,
      topic_id: topicId,
      status: 'todo',
    });

    const saved = await this.userTopicRepository.save(assignment);

    return {
      message: 'success',
    };
  }

  /**
   * Remove topic assignment by user ID and topic ID (admin operation)
   */
  async removeTopicAssignment(userId: number, topicId: number) {
    // Validate user exists and is active
    await this.validateUserExistsAndActive(userId);

    const assignment = await this.userTopicRepository.findOne({
      where: { user_id: userId, topic_id: topicId },
    });

    if (!assignment) {
      throw new NotFoundException(
        `No assignment found for user ${userId} in topic ${topicId}`,
      );
    }

    await this.userTopicRepository.remove(assignment);

    return {
      success: true,
      message: `User ${userId} removed from topic ${topicId}`,
    };
  }

  // ----------------------------------------------------------------------------
  // 2. QUERY OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Get topics for a user with pagination
   * Returns only assigned topics
   */
  async getUserTopics(userId: number, queryDto: UserTopicQueryDto) {
    const { page = 1, limit = 10, status, moduleId, topicId } = queryDto;

    // Validate user exists and is active
    await this.validateUserExistsAndActive(userId);

    // Build where conditions
    const where: any = { user_id: userId };
    if (status) {
      where.status = status;
    }
    if (topicId) {
      where.topic_id = topicId;
    }

    // Apply moduleId filter if provided
    let assignments: UserTopic[];
    let total: number;

    if (moduleId) {
      // Need to filter by module - use query builder
      const queryBuilder = this.userTopicRepository
        .createQueryBuilder('ut')
        .innerJoin('module_topics', 'mt', 'mt.topic_id = ut.topic_id')
        .where('ut.user_id = :userId', { userId })
        .andWhere('mt.module_id = :moduleId', { moduleId });

      if (status) {
        queryBuilder.andWhere('ut.status = :status', { status });
      }
      if (topicId) {
        queryBuilder.andWhere('ut.topic_id = :topicId', { topicId });
      }

      queryBuilder
        .orderBy('ut.created_on', 'DESC')
        .skip((page - 1) * limit)
        .take(limit);

      assignments = await queryBuilder.getMany();

      const countQuery = queryBuilder.clone();
      total = await countQuery.getCount();
    } else {
      // No module filter - use simpler find
      [assignments, total] = await this.userTopicRepository.findAndCount({
        where,
        order: { created_on: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });
    }

    // Map to response format
    const data = assignments.map((assignment) => ({
      id: assignment.id,
      user_id: assignment.user_id,
      topic_id: assignment.topic_id,
      status: assignment.status,
      created_on: assignment.created_on,
      updated_on: assignment.updated_on,
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
   * Get user topic assignment details for a specific topic
   */
  async getUserTopic(userId: number, topicId: number) {
    // Validate user exists and is active
    await this.validateUserExistsAndActive(userId);

    const assignment = await this.userTopicRepository.findOne({
      where: { user_id: userId, topic_id: topicId },
    });

    if (!assignment) {
      throw new NotFoundException(
        `No assignment found for user ${userId} in topic ${topicId}`,
      );
    }

    return {
      id: assignment.id,
      user_id: assignment.user_id,
      topic_id: assignment.topic_id,
      status: assignment.status,
      created_on: assignment.created_on,
      updated_on: assignment.updated_on,
    };
  }

  // ----------------------------------------------------------------------------
  // 3. UPDATE OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Update user topic assignment (status only)
   * Validates forward-only status progression
   */
  async updateUserTopic(
    userId: number,
    topicId: number,
    updateDto: UpdateUserTopicDto,
  ) {
    // Validate user exists and is active
    await this.validateUserExistsAndActive(userId);

    // Find the assignment
    const assignment = await this.userTopicRepository.findOne({
      where: { user_id: userId, topic_id: topicId },
    });

    if (!assignment) {
      throw new NotFoundException(
        `No assignment found for user ${userId} in topic ${topicId}`,
      );
    }

    // Apply updates with validation
    this.applyAssignmentUpdates(assignment, updateDto);

    const updated = await this.userTopicRepository.save(assignment);

    return {
      message: 'User topic updated successfully',
      data: {
        id: updated.id,
        user_id: updated.user_id,
        topic_id: updated.topic_id,
        status: updated.status,
        created_on: updated.created_on,
        updated_on: updated.updated_on,
      },
    };
  }

  // ----------------------------------------------------------------------------
  // 4. CLEANUP OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Cleanup all topic assignments for a user (used when deleting a user)
   * Does not validate if user exists since it's called during deletion
   */
  async cleanupTopicsForUser(userId: number): Promise<number> {
    const assignments = await this.userTopicRepository.find({
      where: { user_id: userId },
    });

    if (assignments.length > 0) {
      await this.userTopicRepository.remove(assignments);
      console.log(
        `Cleaned up ${assignments.length} topic assignment(s) for user ${userId}`,
      );
    }

    return assignments.length;
  }

  /**
   * Cleanup all topic assignments from a specific module for a user
   * Called when user is unenrolled from a module (by admin)
   */
  async cleanupTopicsForModule(userId: number, moduleId: number): Promise<number> {
    // Get all topics from this module
    const moduleTopics = await this.moduleTopicRepository.find({
      where: { module_id: moduleId },
    });

    if (moduleTopics.length === 0) {
      return 0;
    }

    const topicIds = moduleTopics.map((mt) => mt.topic_id);

    // Delete user topic assignments for these topics
    const result = await this.userTopicRepository
      .createQueryBuilder()
      .delete()
      .from(UserTopic)
      .where('user_id = :userId', { userId })
      .andWhere('topic_id IN (:...topicIds)', { topicIds })
      .execute();

    const deletedCount = result.affected || 0;

    if (deletedCount > 0) {
      console.log(
        `Cleaned up ${deletedCount} topic assignment(s) for user ${userId} from module ${moduleId}`,
      );
    }

    return deletedCount;
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
   * Validates that a topic exists
   * @throws NotFoundException if topic doesn't exist
   */
  private async validateTopicExists(topicId: number): Promise<Topic> {
    const topic = await this.topicRepository.findOne({
      where: { id: topicId },
    });

    if (!topic) {
      throw new NotFoundException(`Topic with ID ${topicId} not found`);
    }

    return topic;
  }

  /**
   * Validates that a user has access to a topic through module enrollment
   * User must be enrolled in at least one module containing this topic
   * @throws ForbiddenException if user doesn't have access
   */
  private async validateUserHasTopicAccess(
    userId: number,
    topicId: number,
  ): Promise<void> {
    const hasAccess = await this.userModuleRepository
      .createQueryBuilder('um')
      .innerJoin('module_topics', 'mt', 'mt.module_id = um.module_id')
      .where('um.user_id = :userId', { userId })
      .andWhere('mt.topic_id = :topicId', { topicId })
      .getOne();

    if (!hasAccess) {
      throw new ForbiddenException(
        `User does not have access to this topic. User must be enrolled in a module containing this topic first.`,
      );
    }
  }

  // ----------------------------------------------------------------------------
  // Update Helpers
  // ----------------------------------------------------------------------------

  /**
   * Applies updates to an assignment entity
   * Validates forward-only status progression: todo -> inProgress -> completed
   */
  private applyAssignmentUpdates(
    assignment: UserTopic,
    updateDto: UpdateUserTopicDto,
  ): void {
    if (updateDto.status !== undefined) {
      // Validate forward-only progression
      const statusOrder = { todo: 0, inProgress: 1, completed: 2 };
      const currentOrder = statusOrder[assignment.status] ?? 0;
      const newOrder = statusOrder[updateDto.status] ?? 0;

      if (newOrder < currentOrder) {
        throw new BadRequestException(
          `Status can only progress forward. Cannot change from '${assignment.status}' to '${updateDto.status}'`,
        );
      }

      assignment.status = updateDto.status;
    }
  }

  // ----------------------------------------------------------------------------
  // Response Mapping Helpers
  // ----------------------------------------------------------------------------

  /**
   * Maps assignment entity to basic response object
   */
  private mapAssignmentToResponse(assignment: UserTopic) {
    return {
      id: assignment.id,
      user_id: assignment.user_id,
      topic_id: assignment.topic_id,
      status: assignment.status,
      created_on: assignment.created_on,
      updated_on: assignment.updated_on,
    };
  }
}

