import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { UserModule } from './entities/user-module.entity';
import { User } from '../users/entities/user.entity';
import { Module } from '../modules/entities/module.entity';
import { ModuleUserQueryDto } from './dto/user-module.dto';
// UserModulesService functionality moved to ModulesController

@Injectable()
export class ModuleUsersService {
  constructor(
    @InjectRepository(UserModule)
    private userModuleRepository: Repository<UserModule>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Module)
    private moduleRepository: Repository<Module>,
    // UserModulesService functionality moved to ModulesController
  ) {}

  async getModuleUsers(moduleId: number, queryDto: ModuleUserQueryDto) {
    const { page = 1, limit = 10, status, scoreMin, scoreMax } = queryDto;

    // Check if module exists
    const module = await this.moduleRepository.findOne({
      where: { id: moduleId },
    });

    if (!module) {
      throw new NotFoundException(`Module with ID ${moduleId} not found`);
    }

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


}
