import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { UserTopicsService } from './user-topics.service';
import { UserTopicQueryDto } from './dto/user-topic-query.dto';
import { UpdateUserTopicDto } from './dto/update-user-topic.dto';
import { CreateUserTopicDto } from './dto/create-user-topic.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorator/roles.decorator';
import { UserRole } from '../common/constants/user-roles';

@Controller({ path: 'users/:userId/topics', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserTopicsController {
  constructor(private readonly userTopicsService: UserTopicsService) {}

  @Post()
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MANAGER,
    UserRole.LEARNER,
  )
  @HttpCode(HttpStatus.CREATED)
  async assignTopic(
    @Param('userId') userId: string,
    @Body() createDto: CreateUserTopicDto,
    @Request() req,
  ) {
    const uid = parseInt(userId, 10);
    if (isNaN(uid)) {
      throw new BadRequestException('Invalid user ID');
    }

    // Learners can only assign to themselves
    if (req.user.role === UserRole.LEARNER && req.user.userId !== uid) {
      throw new BadRequestException(
        'Learners can only assign topics to themselves',
      );
    }

    return await this.userTopicsService.assignTopic(uid, createDto.topicId, createDto.userModuleId);
  }

  // Link endpoint - alias for POST assignment
  @Post('link')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MANAGER,
    UserRole.LEARNER,
  )
  @HttpCode(HttpStatus.CREATED)
  async linkTopic(
    @Param('userId') userId: string,
    @Body() createDto: CreateUserTopicDto,
    @Request() req,
  ) {
    const uid = parseInt(userId, 10);
    if (isNaN(uid)) {
      throw new BadRequestException('Invalid user ID');
    }

    // Learners can only assign to themselves
    if (req.user.role === UserRole.LEARNER && req.user.userId !== uid) {
      throw new BadRequestException(
        'Learners can only assign topics to themselves',
      );
    }

    return await this.userTopicsService.assignTopic(uid, createDto.topicId, createDto.userModuleId);
  }

  @Get(':topicId')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MANAGER,
    UserRole.LEARNER,
  )
  async getUserTopic(
    @Param('userId') userId: string,
    @Param('topicId') topicId: string,
    @Request() req,
  ) {
    const uid = parseInt(userId, 10);
    const tid = parseInt(topicId, 10);
    if (isNaN(uid) || isNaN(tid)) {
      throw new BadRequestException('Invalid user ID or topic ID');
    }

    // Learners can only view their own topics
    if (req.user.role === UserRole.LEARNER && req.user.userId !== uid) {
      throw new BadRequestException('Learners can only view their own topics');
    }

    return this.userTopicsService.getUserTopic(uid, tid);
  }

  @Get()
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MANAGER,
    UserRole.LEARNER,
  )
  async getUserTopics(
    @Param('userId') userId: string,
    @Query() queryDto: UserTopicQueryDto,
    @Request() req,
    @Res() res: Response,
  ) {
    const uid = parseInt(userId, 10);
    if (isNaN(uid)) {
      throw new BadRequestException('Invalid user ID');
    }

    // Learners can only view their own topics
    if (req.user.role === UserRole.LEARNER && req.user.userId !== uid) {
      throw new BadRequestException('Learners can only view their own topics');
    }

    const result = await this.userTopicsService.getUserTopics(uid, queryDto);

    // Return 204 No Content if no data in response
    if (result.data.length === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    return res.status(HttpStatus.OK).json(result);
  }

  @Patch(':topicId')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async updateUserTopic(
    @Param('userId') userId: string,
    @Param('topicId') topicId: string,
    @Body() updateDto: UpdateUserTopicDto,
  ) {
    const uid = parseInt(userId, 10);
    const tid = parseInt(topicId, 10);
    if (isNaN(uid) || isNaN(tid)) {
      throw new BadRequestException('Invalid user ID or topic ID');
    }
    return this.userTopicsService.updateUserTopic(uid, tid, updateDto);
  }

  @Delete(':topicId')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async removeTopicAssignment(
    @Param('userId') userId: string,
    @Param('topicId') topicId: string,
  ) {
    const uid = parseInt(userId, 10);
    const tid = parseInt(topicId, 10);
    if (isNaN(uid) || isNaN(tid)) {
      throw new BadRequestException('Invalid user ID or topic ID');
    }

    return this.userTopicsService.removeTopicAssignment(uid, tid);
  }
}

