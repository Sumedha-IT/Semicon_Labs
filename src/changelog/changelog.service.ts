import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChangeLog } from './entities/changelog.entity';
import { CreateChangeLogDto } from './dto/create-changelog.dto';
import { ChangeLogQueryDto } from './dto/changelog-query.dto';

@Injectable()
export class ChangelogService {
  constructor(
    @InjectRepository(ChangeLog)
    private readonly changeLogRepository: Repository<ChangeLog>,
  ) {}

  /**
   * Create a new changelog entry
   */
  async createLog(createChangeLogDto: CreateChangeLogDto): Promise<ChangeLog> {
    const log = this.changeLogRepository.create(createChangeLogDto);
    return await this.changeLogRepository.save(log);
  }

  /**
   * Find all changelog entries with optional filtering and pagination
   * Includes user details via JOIN
   */
  async findAll(queryDto: ChangeLogQueryDto): Promise<{
    data: ChangeLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { changeType, changeTypeId, page = 1, limit = 10 } = queryDto;

    const query = this.changeLogRepository
      .createQueryBuilder('changelog')
      .leftJoinAndSelect('changelog.user', 'user')
      .select([
        'changelog',
        'user.id',
        'user.name',
        'user.email',
      ])
      .orderBy('changelog.updated_on', 'DESC');

    if (changeType) {
      query.andWhere('changelog.changeType = :changeType', { changeType });
    }

    if (changeTypeId) {
      query.andWhere('changelog.changeTypeId = :changeTypeId', { changeTypeId });
    }

    // Pagination
    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Find changelog entries for a specific entity type and id
   */
  async findByEntity(changeType: string, changeTypeId: number): Promise<ChangeLog[]> {
    return await this.changeLogRepository
      .createQueryBuilder('changelog')
      .leftJoinAndSelect('changelog.user', 'user')
      .select([
        'changelog',
        'user.id',
        'user.name',
        'user.email',
      ])
      .where('changelog.changeType = :changeType', { changeType })
      .andWhere('changelog.changeTypeId = :changeTypeId', { changeTypeId })
      .orderBy('changelog.updated_on', 'DESC')
      .getMany();
  }
}

