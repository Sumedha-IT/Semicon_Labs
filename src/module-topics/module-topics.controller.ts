import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ModuleTopicsService } from './module-topics.service';
import { CreateModuleTopicDto } from './dto/create-module-topic.dto';
import { UpdateModuleTopicDto } from './dto/update-module-topic.dto';
import { LinkTopicDto } from './dto/link-topic.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorator/roles.decorator';
import { UserRole } from '../common/constants/user-roles';

@Controller({ path: 'modules', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class ModuleTopicsController {
  constructor(private readonly svc: ModuleTopicsService) {}

  // GET /v1/modules/:id/topics
  @Get(':id/topics')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  async getTopics(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
    @Query('level') level?: string,
  ) {
    const result = await this.svc.getTopicsByModule(
      id,
      parseInt(page as string, 10) || 1,
      parseInt(limit as string, 10) || 10,
      search,
      level,
    );

    if (result.data.length === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }
    return res.status(HttpStatus.OK).json(result);
  }

  // GET /v1/modules/:id/topics/:topicId - Get specific topic details in module
  @Get(':id/topics/:topicId')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  async getTopicInModule(
    @Param('id', ParseIntPipe) id: number,
    @Param('topicId', ParseIntPipe) topicId: number,
  ) {
    return this.svc.getTopicInModule(id, topicId);
  }

  // Bulk operations with body
  @Post(':id/topics/link')
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async linkTopics(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LinkTopicDto,
  ) {
    const result = await this.svc.linkTopics(id, dto.topicIds);

    // Build message similar to domain-modules pattern
    const messages: string[] = [];

    if (result.linked.length > 0) {
      messages.push(`Topics ${result.linked.join(', ')} linked successfully`);
    }

    if (result.skipped.length > 0) {
      messages.push(`Topics ${result.skipped.join(', ')} were already linked`);
    }

    return {
      message: messages.join('. '),
    };
  }

  @Delete(':id/topics/link')
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async unlinkTopics(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LinkTopicDto,
  ) {
    return this.svc.unlinkTopics(id, dto.topicIds);
  }

  // Single topic operations (no body needed)
  @Post(':id/topics/:topicId/link')
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async linkSingleTopic(
    @Param('id', ParseIntPipe) id: number,
    @Param('topicId', ParseIntPipe) topicId: number,
  ) {
    const result = await this.svc.linkTopics(id, [topicId]);
    return {
      message: `Topic ${topicId} linked successfully`,
    };
  }

  @Delete(':id/topics/:topicId/link')
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async unlinkSingleTopic(
    @Param('id', ParseIntPipe) id: number,
    @Param('topicId', ParseIntPipe) topicId: number,
  ) {
    return this.svc.unlinkTopic(id, topicId);
  }

  // PATCH /v1/modules/:id/topics/:topicId - Update topic order
  @Patch(':id/topics/:topicId')
  @Roles(UserRole.PLATFORM_ADMIN)
  async updateTopicOrder(
    @Param('id', ParseIntPipe) id: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() dto: UpdateModuleTopicDto,
  ) {
    return this.svc.updateTopicOrder(id, topicId, dto);
  }
}


