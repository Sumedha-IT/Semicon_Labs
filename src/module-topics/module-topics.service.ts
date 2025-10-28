import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModuleTopic } from './entities/module-topic.entity';
import { Module as ModuleEntity } from '../modules/entities/module.entity';
import { Topic } from '../topics/entities/topic.entity';
import { CreateModuleTopicDto } from './dto/create-module-topic.dto';
import { UpdateModuleTopicDto } from './dto/update-module-topic.dto';

@Injectable()
export class ModuleTopicsService {
  constructor(
    @InjectRepository(ModuleTopic)
    private readonly mtRepo: Repository<ModuleTopic>,
    @InjectRepository(ModuleEntity)
    private readonly moduleRepo: Repository<ModuleEntity>,
    @InjectRepository(Topic)
    private readonly topicRepo: Repository<Topic>,
  ) {}

  private async ensureModule(moduleId: number) {
    const m = await this.moduleRepo.findOne({ where: { id: moduleId } });
    if (!m) throw new NotFoundException(`Module with ID ${moduleId} not found`);
  }

  private async ensureTopic(topicId: number) {
    const t = await this.topicRepo.findOne({ where: { id: topicId } });
    if (!t) throw new NotFoundException(`Topic with ID ${topicId} not found`);
  }

  private async validateTopicsExist(topicIds: number[]): Promise<number[]> {
    const uniq = [...new Set(topicIds)];
    const found = await this.topicRepo
      .createQueryBuilder('t')
      .where('t.id IN (:...ids)', { ids: uniq })
      .getMany();
    const validIds = new Set(found.map((t) => t.id));
    return uniq.filter((id) => !validIds.has(id));
  }

  async linkTopicToModule(dto: CreateModuleTopicDto) {
    await this.ensureModule(dto.module_id);
    await this.ensureTopic(dto.topic_id);

    // Check if already linked
    const existing = await this.mtRepo.findOne({
      where: { module_id: dto.module_id, topic_id: dto.topic_id },
    });

    if (existing) {
      throw new ConflictException(
        `Topic ${dto.topic_id} is already linked to Module ${dto.module_id}`,
      );
    }

    // Auto-calculate order if not provided
    let order = dto.topic_order;
    if (!order) {
      const maxOrder = await this.mtRepo
        .createQueryBuilder('mt')
        .select('MAX(mt.topic_order_in_module)', 'max')
        .where('mt.module_id = :moduleId', { moduleId: dto.module_id })
        .getRawOne();
      
      order = (maxOrder?.max || 0) + 1;
    }

    const moduleTopic = this.mtRepo.create({
      module_id: dto.module_id,
      topic_id: dto.topic_id,
      topic_order: order,
    });
    return await this.mtRepo.save(moduleTopic);
  }

  async linkTopics(moduleId: number, topicIds: number[]) {
    await this.ensureModule(moduleId);

    const uniq = [...new Set(topicIds)];
    const found = await this.topicRepo
      .createQueryBuilder('t')
      .where('t.id IN (:...ids)', { ids: uniq })
      .getMany();
    const validIds = new Set(found.map((t) => t.id));
    const invalid = uniq.filter((id) => !validIds.has(id));
    if (invalid.length) {
      throw new NotFoundException(`Topics not found: ${invalid.join(', ')}`);
    }

    const existing = await this.mtRepo.find({ where: { module_id: moduleId } });
    const existingIds = new Set(existing.map((e) => e.topic_id));
    const toInsert = uniq.filter((id) => !existingIds.has(id));

    if (toInsert.length) {
      const maxOrder = existing.length > 0 
        ? Math.max(...existing.map(e => e.topic_order))
        : 0;
      
      await this.mtRepo.save(
        toInsert.map((topic_id, index) => 
          this.mtRepo.create({ 
            module_id: moduleId, 
            topic_id,
            topic_order: maxOrder + index + 1
          })
        ),
      );
    }

    return {
      linked: toInsert,
      skipped: uniq.filter((id) => existingIds.has(id)),
      invalid,
    };
  }

  async unlinkTopic(moduleId: number, topicId: number) {
    await this.ensureModule(moduleId);
    await this.ensureTopic(topicId);
    
    // Get the topic order before deletion for reordering
    const moduleTopic = await this.mtRepo.findOne({
      where: { module_id: moduleId, topic_id: topicId },
    });
    
    if (!moduleTopic) {
      throw new NotFoundException(`Topic ${topicId} not linked to module ${moduleId}`);
    }
    
    const deletedOrder = moduleTopic.topic_order;
    
    // Delete the module-topic link
    await this.mtRepo.delete({ module_id: moduleId, topic_id: topicId });
    
    // Reorder remaining topics to fill the gap
    await this.mtRepo
      .createQueryBuilder()
      .update()
      .set({ topic_order: () => 'topic_order_in_module - 1' })
      .where('module_id = :moduleId', { moduleId })
      .andWhere('topic_order_in_module > :deletedOrder', { deletedOrder })
      .execute();
    
    return { 
      message: `Topic ${topicId} unlinked from module ${moduleId} and remaining topics reordered`,
      moduleId, 
      topicId 
    };
  }

  async unlinkTopics(moduleId: number, topicIds: number[]) {
    await this.ensureModule(moduleId);
    
    // Validate all topics exist
    const invalidTopics = await this.validateTopicsExist(topicIds);
    if (invalidTopics.length > 0) {
      throw new BadRequestException(`Topics not found: ${invalidTopics.join(', ')}`);
    }

    // Get orders of topics to be unlinked for reordering
    const topicsToUnlink = await this.mtRepo
      .createQueryBuilder('mt')
      .where('mt.module_id = :moduleId', { moduleId })
      .andWhere('mt.topic_id IN (:...topicIds)', { topicIds })
      .select(['mt.topic_order'])
      .getMany();

    if (topicsToUnlink.length === 0) {
      throw new NotFoundException(
        `None of the specified topics are linked to module ${moduleId}`,
      );
    }

    // Unlink all topics
    const result = await this.mtRepo
      .createQueryBuilder()
      .delete()
      .where('module_id = :moduleId', { moduleId })
      .andWhere('topic_id IN (:...topicIds)', { topicIds })
      .execute();

    // Reorder remaining topics to fill gaps
    // Get the highest order that was deleted
    const maxDeletedOrder = Math.max(...topicsToUnlink.map(t => t.topic_order));
    
    // Decrement orders of remaining topics that were after the deleted ones
    await this.mtRepo
      .createQueryBuilder()
      .update()
      .set({ topic_order: () => 'topic_order_in_module - 1' })
      .where('module_id = :moduleId', { moduleId })
      .andWhere('topic_order_in_module > :maxDeletedOrder', { maxDeletedOrder })
      .execute();

    return {
      message: `Successfully unlinked ${result.affected} topic(s) from module ${moduleId} and reordered remaining topics`,
      unlinkedCount: result.affected,
    };
  }

  async getTopicsByModule(moduleId: number, page = 1, limit = 10, search?: string, level?: string) {
    await this.ensureModule(moduleId);

    const qb = this.topicRepo
      .createQueryBuilder('t')
      .innerJoin('module_topics', 'mt', 'mt.topic_id = t.id')
      .where('mt.module_id = :moduleId', { moduleId });

    if (search) qb.andWhere('t.title ILIKE :s OR t.desc ILIKE :s', { s: `%${search}%` });
    if (level) qb.andWhere('t.level = :level', { level });

    const total = await qb.getCount();
    const data = await qb
      .select([
        't.id AS id',
        't.title AS title',
        't.desc AS description',
        't.level AS level',
        't.created_on AS created_on',
        't.updated_on AS updated_on',
        'mt.topic_order_in_module AS topic_order',
      ])
      .orderBy('mt.topic_order_in_module', 'ASC')
      .addOrderBy('t.created_on', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany();

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getTopicInModule(moduleId: number, topicId: number) {
    await this.ensureModule(moduleId);
    await this.ensureTopic(topicId);

    const result = await this.topicRepo
      .createQueryBuilder('t')
      .innerJoin('module_topics', 'mt', 'mt.topic_id = t.id')
      .where('mt.module_id = :moduleId', { moduleId })
      .andWhere('mt.topic_id = :topicId', { topicId })
      .select([
        't.id AS id',
        't.title AS title',
        't.desc AS description',
        't.level AS level',
        't.created_on AS created_on',
        't.updated_on AS updated_on',
        'mt.topic_order_in_module AS topic_order',
      ])
      .getRawOne();

    if (!result) {
      throw new NotFoundException(`Topic ${topicId} not linked to module ${moduleId}`);
    }

    return result;
  }

  async updateTopicOrder(moduleId: number, topicId: number, dto: UpdateModuleTopicDto) {
    await this.ensureModule(moduleId);
    await this.ensureTopic(topicId);

    const moduleTopic = await this.mtRepo.findOne({
      where: { module_id: moduleId, topic_id: topicId },
    });

    if (!moduleTopic) {
      throw new NotFoundException(`Topic ${topicId} not linked to module ${moduleId}`);
    }

    if (dto.topic_order !== undefined) {
      moduleTopic.topic_order = dto.topic_order;
    }

    return await this.mtRepo.save(moduleTopic);
  }

  async getModulesByTopic(topicId: number, page = 1, limit = 10) {
    await this.ensureTopic(topicId);

    const qb = this.moduleRepo
      .createQueryBuilder('m')
      .innerJoin('module_topics', 'mt', 'mt.module_id = m.id')
      .where('mt.topic_id = :topicId', { topicId });

    const total = await qb.getCount();
    const data = await qb
      .select([
        'm.id AS id',
        'm.title AS title',
        'm.desc AS description',
        'm.duration AS duration',
        'm.level AS level',
        'm.created_on AS created_on',
        'm.updated_on AS updated_on',
      ])
      .orderBy('m.created_on', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany();

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}


