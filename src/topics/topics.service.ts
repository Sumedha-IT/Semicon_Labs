import{
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository} from '@nestjs/typeorm';
import{Topic} from './entities/topic.entity';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { TopicQueryDto } from './dto/topic-query.dto';
import { Repository,ILike,FindManyOptions } from 'typeorm';
import { Module as ModuleEntity } from '../modules/entities/module.entity';
import { ChangelogService } from '../changelog/changelog.service';
import { QueryBuilderHelper } from '../common/utils/query-builder.helper';

@Injectable()
export class TopicsService {
    constructor(
        @InjectRepository(Topic)
        private readonly topicRepo: Repository<Topic>,
        @InjectRepository(ModuleEntity)
        private readonly moduleRepo: Repository<ModuleEntity>,
        private readonly changelogService: ChangelogService,
    ) {}

    // ============================================================================
    // PUBLIC METHODS
    // ============================================================================

    // ----------------------------------------------------------------------------
    // 1. CORE CRUD OPERATIONS
    // ----------------------------------------------------------------------------

    /**
     * Creates a new topic
     * Validates topic title uniqueness before creation
     */
    async create(dto: CreateTopicDto): Promise<Topic> {
        // Validate topic title is unique
        await this.validateTopicTitleUnique(dto.title);
        
        // Create topic entity from DTO
        const topic = this.topicRepo.create(dto);
        // Save to database
        const savedTopic = await this.topicRepo.save(topic);
        
        // Return only id and title
        const result = await this.topicRepo.findOne({
            where: { id: savedTopic.id },
            select: {
                id: true,
                title: true,
            },
        });

        if (!result) {
            throw new NotFoundException('Topic creation failed');
        }

        return result;
    }

    /**
     * Finds a single topic by ID
     * @throws NotFoundException if topic doesn't exist
     */
    async findOne(id: number): Promise<Topic> {
        const topic = await this.topicRepo.findOne({ where: { id } });
     if(!topic){
        throw new NotFoundException(`Topic with ID ${id} not found`);
     }
     return topic;
     }

    /** 
     * Updates an existing topic
     * Validates topic title uniqueness before update
     */
    async update(id: number, dto: UpdateTopicDto, userId: number): Promise<Topic> {
        const topic = await this.findOne(id);
        
        // Extract reason for changelog (don't save it in topic)
        const { reason, ...topicData } = dto;
        
        // Validate title uniqueness if title is being updated
        if (topicData.title && topicData.title !== topic.title) {
            await this.validateTopicTitleUnique(topicData.title);
        }
        
        // Merge the DTO into the existing topic
        Object.assign(topic, topicData);
        
        // Save updated topic
        await this.topicRepo.save(topic);
        
        // Create changelog entry
        await this.changelogService.createLog({
            changeType: 'topic',
            changeTypeId: id,
            userId: userId,
            reason,
        });
        
        // Return only id and title
        const result = await this.topicRepo.findOne({
            where: { id },
            select: {
                id: true,
                title: true,
            },
        });

        if (!result) {
            throw new NotFoundException(`Topic with ID ${id} not found after update`);
        }

        return result;
    }

    /**
     * Deletes a topic by ID
     * @throws NotFoundException if topic doesn't exist
     */
    async remove(id: number): Promise<{ message: string }> {
        const topic = await this.findOne(id);
        await this.topicRepo.remove(topic);
        return { message: `Topic with ID ${id} has been deleted successfully` };
    }
    
    // ----------------------------------------------------------------------------
    // 2. QUERY OPERATIONS
    // ----------------------------------------------------------------------------
    
    
    /**
     * Finds all topics with optional search filter
     * Returns topics sorted by title in ascending order
     * @param search - Optional search term to filter topic titles (case-insensitive)
     */
    async findAll(search?: string): Promise<Topic[]> {
        const options: FindManyOptions<Topic> = {
            select: {
                id: true,
                title: true,
                desc: true,
                level: true,
            },
            order: { title: 'ASC' },
        };
        
        // Add search filter if provided
        if (search) {
            options.where = { title: ILike(`%${search}%`) };
        }
        
        // Execute and return
        return await this.topicRepo.find(options);
    }

    /**
     * Finds topics with advanced filtering, pagination, and sorting
     */
    async findWithFilters(queryDto: TopicQueryDto) {
        const {
            search,
            level,
            moduleId,
            page = 1,
            limit = 10,
            sortBy = 'title',
            sortOrder = 'ASC',
        } = queryDto;

        // Validate module exists if moduleId is provided
        if (moduleId) {
            const module = await this.moduleRepo.findOne({ where: { id: moduleId } });
            if (!module) {
                throw new NotFoundException(`Module with ID ${moduleId} not found`);
            }
        }

        // If filtering by module, use subquery approach
        if (moduleId) {
            // Get topic IDs that belong to this module
            const topicIdsResult = await this.topicRepo
                .createQueryBuilder('topic')
                .select('DISTINCT topic.id', 'id')
                .innerJoin('module_topics', 'mt', 'mt.topic_id = topic.id')
                .where('mt.module_id = :moduleId', { moduleId })
                .getRawMany();
            
            const topicIds = topicIdsResult.map(row => row.id);
            
            if (topicIds.length === 0) {
                return {
                    data: [],
                    total: 0,
                    page,
                    limit,
                    totalPages: 0,
                };
            }

            // Build query with topic IDs filter
            const queryBuilder = this.topicRepo
                .createQueryBuilder('topic')
                .where('topic.id IN (:...topicIds)', { topicIds });

            // Apply filters using QueryBuilderHelper
            QueryBuilderHelper.applySearch(queryBuilder, 'topic', ['title'], search);
            QueryBuilderHelper.applyEqualityFilter(queryBuilder, 'topic', 'level', level);

            // Apply sorting
            const columnMap: Record<string, string> = {
                title: 'title',
                level: 'level',
                createdOn: 'created_on',
                updatedOn: 'updated_on',
            };
            QueryBuilderHelper.applySorting(
                queryBuilder,
                'topic',
                columnMap,
                sortBy,
                sortOrder,
                'title',
            );

            // Apply pagination
            const result = await QueryBuilderHelper.paginate(queryBuilder, page, limit);
            
            return result;
        } else {
            // Simple query without module filter
            const queryBuilder = this.topicRepo.createQueryBuilder('topic');

            // Apply filters using QueryBuilderHelper
            QueryBuilderHelper.applySearch(queryBuilder, 'topic', ['title'], search);
            QueryBuilderHelper.applyEqualityFilter(queryBuilder, 'topic', 'level', level);

            // Apply sorting
            const columnMap: Record<string, string> = {
                title: 'title',
                level: 'level',
                createdOn: 'created_on',
                updatedOn: 'updated_on',
            };
            QueryBuilderHelper.applySorting(
                queryBuilder,
                'topic',
                columnMap,
                sortBy,
                sortOrder,
                'title',
            );

            // Apply pagination
            const result = await QueryBuilderHelper.paginate(queryBuilder, page, limit);

            return result;
        }
    }
    
    // ----------------------------------------------------------------------------
    // 3. PRIVATE HELPERS
    // ----------------------------------------------------------------------------
    
    
    /**
     * Validates topic title uniqueness
     * @throws ConflictException if title is not unique
     */
    private async validateTopicTitleUnique(title: string): Promise<void> {
        const existingTopic = await this.topicRepo.findOne({ where: { title } });
        
        if (existingTopic) {
            throw new ConflictException(`Topic with title "${title}" already exists`);
        }
    }
}