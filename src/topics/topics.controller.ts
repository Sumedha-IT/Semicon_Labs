import{
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    HttpCode,
    HttpStatus,
    UseGuards,
    BadRequestException,
    Res,
} from '@nestjs/common';
import { TopicsService } from './topics.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { TopicQueryDto } from './dto/topic-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorator/roles.decorator';
import { GetUser } from '../common/decorator/get-user.decorator';
import { UserRole } from '../common/constants/user-roles';
import { Response } from 'express';

@Controller({ path: 'topics', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class TopicsController {
    constructor(private readonly topicsService: TopicsService) {}

    @Post()
    @Roles(UserRole.PLATFORM_ADMIN)
    @HttpCode(HttpStatus.CREATED)
    create(@Body() dto: CreateTopicDto) {
        return this.topicsService.create(dto);
    }
    
    @Get()
    @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
    async findAll(@Query() queryDto: TopicQueryDto, @Res() res: Response) {
        // Check if any advanced query params are provided
        const hasAdvancedQuery = queryDto.level || queryDto.moduleId || 
                                queryDto.page || queryDto.limit || 
                                queryDto.sortBy || queryDto.sortOrder;

        // Use advanced filtering if any query params are provided
        if (hasAdvancedQuery || queryDto.search) {
            const result = await this.topicsService.findWithFilters(queryDto);
            
            // Return 204 No Content if no results found
            if (result.data.length === 0) {
                return res.status(HttpStatus.NO_CONTENT).send();
            }

            return res.status(HttpStatus.OK).json(result);
        }

        // Use simple query if no params provided (backward compatibility)
        const topics = await this.topicsService.findAll();
        
        // Return 204 No Content if no results found
        if (topics.length === 0) {
            return res.status(HttpStatus.NO_CONTENT).send();
        }

        return res.status(HttpStatus.OK).json(topics);
    }
    
    @Get(':id')
    @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
    async findOne(@Res() res: Response, @Param('id') id: string) { 
        const topic = await this.topicsService.findOne(+id);     
        return res.status(HttpStatus.OK).json(topic);
    }
    
    @Patch(':id')
    @Roles(UserRole.PLATFORM_ADMIN)
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateTopicDto,
        @GetUser('userId') userId: number,
    ) {
        return this.topicsService.update(+id, dto, userId);
    }
    
    @Delete(':id')
    @Roles(UserRole.PLATFORM_ADMIN)
    @HttpCode(HttpStatus.OK)
    async remove(
        @Param('id') id: string,
        @Body() body: { reason: string },
        @GetUser() user: any
    ) {
        const topicId = parseInt(id, 10);
        if (isNaN(topicId)) {
            throw new BadRequestException('Invalid topic ID');
        }
        
        // Validate that reason is provided and not empty
        if (!body?.reason || body.reason.trim().length === 0) {
            throw new BadRequestException('Reason is required for topic deletion');
        }
        
        return this.topicsService.remove(topicId, user.userId, body.reason.trim());
    }
}
