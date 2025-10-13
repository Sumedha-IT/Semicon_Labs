import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { UserModule } from './entities/user-module.entity';
import { User } from '../users/entities/user.entity';
import { Module } from '../modules/entities/module.entity';
import { ModuleUserQueryDto, EnrollUserDto } from './dto/user-module.dto';
import { UserModulesService } from './user-modules.service';

@Injectable()
export class ModuleUsersService {
  constructor(
    @InjectRepository(UserModule)
    private userModuleRepository: Repository<UserModule>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Module)
    private moduleRepository: Repository<Module>,
    private readonly userModulesService: UserModulesService,
  ) {}

  async getModuleUsers(moduleId: number, queryDto: ModuleUserQueryDto) {
    const { page = 1, limit = 10, status, score_min, score_max } = queryDto;

    // Check if module exists
    const module = await this.moduleRepository.findOne({
      where: { id: moduleId },
    });

    if (!module) {
      throw new NotFoundException(`Module with ID ${moduleId} not found`);
    }

    const queryBuilder = this.userModuleRepository
      .createQueryBuilder('um')
      .innerJoin('users', 'u', 'u.user_id = um.user_id')
      .innerJoin('modules', 'm', 'm.id = um.module_id')
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

    if (score_min !== undefined) {
      queryBuilder.andWhere('um.score >= :score_min', { score_min });
    }

    if (score_max !== undefined) {
      queryBuilder.andWhere('um.score <= :score_max', { score_max });
    }

    // Select fields
    queryBuilder.select([
      'um.id AS id',
      'um.user_id AS user_id',
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

  async getPassedUsers(moduleId: number) {
    return this.getModuleUsers(moduleId, { status: 'passed' });
  }

  async getFailedUsers(moduleId: number) {
    return this.getModuleUsers(moduleId, { status: 'failed' });
  }

  async getModuleStats(moduleId: number) {
    // Check if module exists
    const module = await this.moduleRepository.findOne({
      where: { id: moduleId },
    });

    if (!module) {
      throw new NotFoundException(`Module with ID ${moduleId} not found`);
    }

    const stats = await this.userModuleRepository
      .createQueryBuilder('um')
      .innerJoin('users', 'u', 'u.user_id = um.user_id')
      .where('um.module_id = :moduleId', { moduleId })
      .andWhere('u.deleted_on IS NULL')
      .select([
        'COUNT(*) as total_enrolled',
        "COUNT(CASE WHEN um.status = 'completed' AND um.score >= 70 THEN 1 END) as passed",
        "COUNT(CASE WHEN um.status = 'completed' AND um.score < 70 THEN 1 END) as failed",
        "COUNT(CASE WHEN um.status = 'in_progress' THEN 1 END) as in_progress",
        "COUNT(CASE WHEN um.status = 'not_started' THEN 1 END) as not_started",
        'AVG(um.score) as average_score',
        'MAX(um.score) as highest_score',
        'MIN(um.score) as lowest_score',
      ])
      .getRawOne();

    return {
      module_id: moduleId,
      module_title: module.title,
      total_enrolled: parseInt(stats.total_enrolled),
      passed: parseInt(stats.passed),
      failed: parseInt(stats.failed),
      in_progress: parseInt(stats.in_progress),
      not_started: parseInt(stats.not_started),
      pass_rate:
        stats.total_enrolled > 0
          ? (
              (parseInt(stats.passed) / parseInt(stats.total_enrolled)) *
              100
            ).toFixed(2)
          : 0,
      average_score: parseFloat(stats.average_score || 0).toFixed(2),
      highest_score: parseFloat(stats.highest_score || 0),
      lowest_score: parseFloat(stats.lowest_score || 0),
    };
  }

  async enrollUserInModule(moduleId: number, enrollDto: EnrollUserDto) {
    return this.userModulesService.enroll(enrollDto.user_id, {
      module_id: moduleId,
    });
  }

  async unenrollUser(userId: number, moduleId: number) {
    return this.userModulesService.unenrollByUserAndModule(userId, moduleId);
  }
}
