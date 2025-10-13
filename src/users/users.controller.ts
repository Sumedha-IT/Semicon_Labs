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
import { UserDomainsService } from '../user-domains/user-domains.service';
import { LinkUserToDomainsDto } from '../user-domains/dto/link-user-to-domains.dto';
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
    private readonly userDomainsService: UserDomainsService,
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
    return { user_id: user.user_id };
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
    return { user_id: user.user_id };
  }

  @Post()
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    return { user_id: user.user_id };
  }

  // Get all users with comprehensive pagination and filtering
  @Get()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  async findAll(
    @Query() queryDto: UserQueryDto,
    @Request() req,
    @Res() res: Response,
  ) {
    console.log(
      'Users v2 endpoint - req.user:',
      JSON.stringify(req.user, null, 2),
    );
    const result = await this.usersService.findUsersWithPagination(
      queryDto,
      req.user,
    );

    // Return 204 No Content if no results found
    if (result.pagination.total === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    return res.status(HttpStatus.OK).json(result);
  }

  // Domain linking endpoints
  @Post(':id/domains')
  @Roles(UserRole.PLATFORM_ADMIN)
  async linkDomains(
    @Param('id') id: string,
    @Body() body: LinkUserToDomainsDto,
  ) {
    const userId = parseInt(id, 10);
    return this.userDomainsService.link(userId, body.domainIds);
  }

  @Get(':id/domains')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  async listUserDomains(@Param('id') id: string) {
    const userId = parseInt(id, 10);
    return this.userDomainsService.listUserDomains(userId);
  }

  @Delete(':id/domains/:domainId')
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlinkDomain(
    @Param('id') id: string,
    @Param('domainId') domainId: string,
  ) {
    const userId = parseInt(id, 10);
    const did = parseInt(domainId, 10);
    await this.userDomainsService.unlink(userId, did);
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
    return { user_id: userId };
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

  @Get('filter/organization/:orgId')
  @Roles(UserRole.PLATFORM_ADMIN)
  filterByOrganization(@Param('orgId') orgId: string, @Request() req) {
    return this.usersService.filterByOrganization(+orgId, req.user);
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

  @Get('stats/by-organization')
  @Roles(UserRole.PLATFORM_ADMIN)
  getUserStatsByOrganization(@Request() req) {
    return this.usersService.getUserStatsByOrganization(req.user);
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
    return { user_id: req.user.userId };
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
