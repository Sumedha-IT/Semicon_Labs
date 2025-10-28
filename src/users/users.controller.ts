import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
  BadRequestException,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateIndividualUserDto } from './dto/create-individual-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorator/roles.decorator';
import { Public } from '../common/decorator/public.decorator';
import { UserRole } from '../common/constants/user-roles';

@Controller({ path: 'users', version: '2' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  // Public self-registration endpoint for individual learners
  @Public()
  @Post('register/individual')
  @HttpCode(HttpStatus.CREATED)
  async registerIndividual(@Body() createUserDto: CreateIndividualUserDto) {
    // Force individual learner fields
    const individualUserData = {
      ...createUserDto,
      org_id: null as any,
      manager_id: null as any,
      role: UserRole.LEARNER,
    };
    const user = await this.usersService.create(individualUserData);
    return { id: user.id };
  }

  // Public registration endpoint for testing (legacy)
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() createUserDto: CreateUserDto) {
    // Set default role to LEARNER if not provided
    const userWithRole = {
      ...createUserDto,
      role: createUserDto.role || UserRole.LEARNER,
    };
    const user = await this.usersService.create(userWithRole);
    return { id: user.id };
  }

  @Post()
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    return { id: user.id };
  }

  // Get all users with comprehensive pagination and filtering
  @Get()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  async findAll(
    @Query() queryDto: UserQueryDto,
    @Query('orgID') orgID: string,
    @Request() req,
    @Res() res: Response,
  ) {
    // If orgID query parameter is provided, filter by organization
    if (orgID) {
      const users = await this.usersService.filterByOrganization(+orgID, req.user);
      return res.status(HttpStatus.OK).json(users);
    }

    // Otherwise, use the normal pagination
    const result = await this.usersService.findUsersWithPagination(
      queryDto,
      req.user,
    );

    // Return 204 No Content if no data in response
    if (result.data.length === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    return res.status(HttpStatus.OK).json(result);
  }



  @Get(':id/modules')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.LEARNER)
  async getUserModules(
    @Param('id') id: string,
    @Query() queryDto: any,
    @Request() req,
    @Res() res: Response,
  ) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    // Check if user has access to view this user's modules
    if (req.user.role === UserRole.LEARNER && req.user.userId !== userId) {
      throw new BadRequestException('Users can only view their own modules');
    }

    // Get user modules using the users service
    const result = await this.usersService.getUserModules(userId, queryDto);

    // Return 204 No Content if no modules found
    if (result.data.length === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    return res.status(HttpStatus.OK).json(result);
  }

  @Get(':id')
  @Roles(UserRole.PLATFORM_ADMIN)
  findOne(@Param('id') id: string) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    // Only PlatformAdmin can see any user across all organizations
    return this.usersService.findOne(userId);
  }

  @Patch(':id')
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    // Only PlatformAdmin can update any user across all organizations
    await this.usersService.update(userId, updateUserDto);
    return { id: userId };
  }

  @Delete(':id')
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    // Only PlatformAdmin can delete any user across all organizations
    return this.usersService.remove(userId);
  }

  // Search and filter operations - Only for PlatformAdmin
  @Get('search/:query')
  @Roles(UserRole.PLATFORM_ADMIN)
  searchUsers(@Param('query') query: string, @Request() req) {
    return this.usersService.searchUsers(query, req.user);
  }

  @Get('filter/role/:role')
  @Roles(UserRole.PLATFORM_ADMIN)
  filterByRole(@Param('role') role: string, @Request() req) {
    return this.usersService.filterByRole(role, req.user);
  }


  // Statistics and analytics - Only for PlatformAdmin
  @Get('stats/overview')
  @Roles(UserRole.PLATFORM_ADMIN)
  getUserStats(@Request() req) {
    return this.usersService.getUserStats(req.user);
  }

  @Get('stats/by-role')
  @Roles(UserRole.PLATFORM_ADMIN)
  getUserStatsByRole(@Request() req) {
    return this.usersService.getUserStatsByRole(req.user);
  }

  

  // User profile management
  @Get('profile/me')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MANAGER,
    UserRole.LEARNER,
  )
  getMyProfile(@Request() req) {
    if (!req.user.userId || isNaN(req.user.userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    return this.usersService.findOne(req.user.userId);
  }

  @Patch('profile/me')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MANAGER,
    UserRole.LEARNER,
  )
  @HttpCode(HttpStatus.OK)
  async updateMyProfile(@Body() updateUserDto: UpdateUserDto, @Request() req) {
    if (!req.user.userId || isNaN(req.user.userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    await this.usersService.update(req.user.userId, updateUserDto);
    return { id: req.user.userId };
  }

  // Password management
  @Patch('change-password')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MANAGER,
    UserRole.LEARNER,
  )
  @HttpCode(HttpStatus.OK)
  changePassword(
    @Body() passwordData: { currentPassword: string; newPassword: string },
    @Request() req,
  ) {
    if (!req.user.userId || isNaN(req.user.userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    return this.usersService.changePassword(
      req.user.userId,
      passwordData.currentPassword,
      passwordData.newPassword,
    );
  }

  @Post('reset-password')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @Body() resetData: { userId: number; newPassword: string },
    @Request() req,
  ) {
    return this.usersService.resetPassword(
      resetData.userId,
      resetData.newPassword,
      req.user,
    );
  }

  // Get individual learners (Platform Admin only)
  @Get('individual-learners')
  @Roles(UserRole.PLATFORM_ADMIN)
  getIndividualLearners() {
    return this.usersService.findIndividualLearners();
  }
}
