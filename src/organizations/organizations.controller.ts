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
  NotFoundException,
  ForbiddenException,
  HttpStatus,
  HttpCode,
  BadRequestException,
  ConflictException,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { validateOrganizationFieldAuthorization } from '../common/utils/field-authorization.helper';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorator/roles.decorator';
import { UserRole } from '../common/constants/user-roles';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { OrganizationQueryDto } from './dto/organization-query.dto';
import { PaginatedResponseDto } from '../users/dto/paginated-response.dto';
import { UserQueryDto } from '../users/dto/user-query.dto';
import { validateUserFieldAuthorization } from '../common/utils/field-authorization.helper';

@Controller({ path: 'organizations', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createOrganizationDto: CreateOrganizationDto) {
    const organization = await this.organizationsService.create(
      createOrganizationDto,
    );
    return { id: organization.id };
  }

  // Get all organizations with comprehensive pagination and filtering
  @Get()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  async findAll(
    @Query() queryDto: OrganizationQueryDto,
    @Request() req,
    @Res() res: Response,
  ) {
    const result =
      await this.organizationsService.findOrganizationsWithPagination(
        queryDto,
        req.user,
      );

    // Return 204 No Content if no data in response
    if (result.data.length === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    return res.status(HttpStatus.OK).json(result);
  }

  @Get(':id')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  async findOne(@Param('id') id: string, @Request() req) {
    const orgId = +id;

    let organization;

    // PlatformAdmin can see any organization
    if (req.user.role === UserRole.PLATFORM_ADMIN) {
      organization = await this.organizationsService.findOne(orgId);
    }
    // ClientAdmin can only see their own organization
    else if (req.user.orgId != null && req.user.orgId === orgId) {
      organization = await this.organizationsService.findOne(orgId);
    } else {
      throw new ForbiddenException(
        'Not authorized to access this organization',
      );
    }

    if (!organization) {
      throw new NotFoundException(`Organization with ID ${orgId} not found`);
    }

    // Add user count to the organization
    const userCount = await this.organizationsService.getUserCount(orgId);
    return {
      ...organization,
      user_count: userCount,
    };
  }

  @Patch(':id')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
    @Request() req,
  ) {
    const orgId = +id;

    // Validate field-level authorization
    validateOrganizationFieldAuthorization(
      updateOrganizationDto,
      req.user.role as UserRole,
    );

    // PlatformAdmin can update any organization
    if (req.user.role === UserRole.PLATFORM_ADMIN) {
      await this.organizationsService.update(orgId, updateOrganizationDto);
      return { org_id: orgId };
    }

    // ClientAdmin can only update their own organization
    if (req.user.orgId === orgId) {
      await this.organizationsService.update(orgId, updateOrganizationDto);
      return { org_id: orgId };
    }

    throw new ForbiddenException('Not authorized to update this organization');
  }


  // User management endpoints for organizations
  @Get(':id/users')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  async getOrganizationUsers(
    @Param('id') id: string,
    @Request() req,
    @Res() res: Response,
    @Query() queryDto: UserQueryDto,
  ) {
    const orgId = +id;

    // Check if user has access to this organization
    if (req.user.role === UserRole.CLIENT_ADMIN && req.user.orgId !== orgId) {
      throw new ForbiddenException(
        'Not authorized to access users from this organization',
      );
    }

    // Create a modified requesting user for the query
    const modifiedReqUser = {
      ...req.user,
      orgId: orgId,
    };

    // If query parameters are provided, use advanced search/filtering
    if (queryDto.search || queryDto.role || queryDto.location || queryDto.deviceNo || 
        queryDto.toolId || queryDto.managerId || queryDto.active !== undefined ||
        queryDto.joinedAfter || queryDto.joinedBefore || queryDto.updatedAfter || 
        queryDto.updatedBefore || queryDto.phone || queryDto.deleted !== undefined) {
      
      const result = await this.usersService.findOrganizationUsersWithPagination(
        queryDto,
        modifiedReqUser,
      );

      // Return 204 No Content if no data in response
      if (result.data.length === 0) {
        return res.status(HttpStatus.NO_CONTENT).send();
      }

      return res.status(HttpStatus.OK).json(result);
    }

    // Default behavior - get all users in organization
    const users = await this.usersService.findByOrganizationWithoutDetails(orgId);

    // Return 204 No Content if no results found
    if (users.length === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    return res.status(HttpStatus.OK).json(users);
  }

  @Post(':id/users')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createOrganizationUser(
    @Param('id') id: string,
    @Body() createUserDto: CreateUserDto,
    @Request() req,
    @Query() queryDto: UserQueryDto,
  ) {
    const orgId = +id;

    // Check if user has access to this organization
    if (req.user.role === UserRole.CLIENT_ADMIN && req.user.orgId !== orgId) {
      throw new ForbiddenException(
        'Not authorized to create users in this organization',
      );
    }

    // If org_id is provided in the request body, use it; otherwise set to organization ID
    if (createUserDto.org_id) {
      // User belongs to organization - validate it matches the organization ID
      if (createUserDto.org_id !== orgId) {
        throw new BadRequestException(
          'Organization ID in request body must match the organization ID in URL',
        );
      }
    } else {
      // Set the organization ID for organization users
      createUserDto.org_id = orgId;
    }

    const user = await this.usersService.create(createUserDto);
    return { id: user.id };
  }

  @Get(':id/users/:userId')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MANAGER,
    UserRole.LEARNER,
  )
  async getOrganizationUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Request() req,
  ) {
    const orgId = +id;
    const userIdNum = +userId;

    // Check if user has access to this organization
    if (req.user.role === UserRole.CLIENT_ADMIN && req.user.orgId !== orgId) {
      throw new ForbiddenException(
        'Not authorized to access users from this organization',
      );
    }

    // Manager and Learner can only see their own profile
    if (
      (req.user.role === UserRole.MANAGER ||
        req.user.role === UserRole.LEARNER) &&
      userIdNum !== req.user.userId
    ) {
      throw new ForbiddenException('Not authorized to access this user');
    }

    const user = await this.usersService.findOneInOrganizationWithoutDetails(userIdNum, orgId);
    
    if (!user) {
      throw new NotFoundException(
        `User with ID ${userIdNum} not found in organization ${orgId}`
      );
    }

    return user;
  }

  @Patch(':id/users/:userId')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.LEARNER)
  @HttpCode(HttpStatus.OK)
  async updateOrganizationUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req,
  ) {
    const orgId = +id;
    const userIdNum = +userId;

    // Check if user has access to this organization
    if (req.user.role === UserRole.CLIENT_ADMIN && req.user.orgId !== orgId) {
      throw new ForbiddenException(
        'Not authorized to update users in this organization',
      );
    }

    // Learner can only update their own profile
    if (req.user.role === UserRole.LEARNER && userIdNum !== req.user.userId) {
      throw new ForbiddenException('Not authorized to update this user');
    }

    // Validate field-level authorization
    const isSelfUpdate = userIdNum === req.user.userId;
    const userRole = req.user.role; // Get role as-is (string or enum)
    
    validateUserFieldAuthorization(
      updateUserDto,
      userRole,
      isSelfUpdate,
    );

    const updatedUser = await this.usersService.updateInOrganization(
      userIdNum,
      orgId,
      updateUserDto,
    );

    return { user_id: userIdNum };
  }

  @Delete(':id/users/:userId')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  async removeOrganizationUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Request() req,
  ) {
    const orgId = +id;
    const userIdNum = +userId;

    // Check if user has access to this organization
    if (req.user.role === UserRole.CLIENT_ADMIN && req.user.orgId !== orgId) {
      throw new ForbiddenException(
        'Not authorized to delete users from this organization',
      );
    }

    const result = await this.usersService.removeFromOrganization(userIdNum, orgId);
    
    if (!result.success) {
      throw new BadRequestException(result.message);
    }

    return { message: result.message };
  }

  // Search and filter operations for organization users
  @Get(':id/users/search/:query')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  async searchOrganizationUsers(
    @Param('id') id: string,
    @Param('query') query: string,
    @Request() req,
    @Res() res: Response,
  ) {
    const orgId = +id;

    // Check if user has access to this organization
    if (req.user.role === UserRole.CLIENT_ADMIN && req.user.orgId !== orgId) {
      throw new ForbiddenException(
        'Not authorized to search users in this organization',
      );
    }

    // Create a modified requesting user for the search
    const modifiedReqUser = {
      ...req.user,
      orgId: orgId,
    };

    const users = await this.usersService.searchUsers(query, modifiedReqUser);

    // Return 204 No Content if no results found
    if (users.length === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    return res.status(HttpStatus.OK).json(users);
  }

  @Get(':id/users/filter/role/:role')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  async filterOrganizationUsersByRole(
    @Param('id') id: string,
    @Param('role') role: string,
    @Request() req,
    @Res() res: Response,
  ) {
    const orgId = +id;

    // Check if user has access to this organization
    if (req.user.role === UserRole.CLIENT_ADMIN && req.user.orgId !== orgId) {
      throw new ForbiddenException(
        'Not authorized to filter users in this organization',
      );
    }

    // Create a modified requesting user for the filter
    const modifiedReqUser = {
      ...req.user,
      orgId: orgId,
    };

    const users = await this.usersService.filterByRole(role, modifiedReqUser);

    // Return 204 No Content if no results found
    if (users.length === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    return res.status(HttpStatus.OK).json(users);
  }

  // Statistics for organization users
  @Get(':id/users/stats')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  getOrganizationUserStats(@Param('id') id: string, @Request() req) {
    const orgId = +id;

    // Check if user has access to this organization
    if (req.user.role === UserRole.CLIENT_ADMIN && req.user.orgId !== orgId) {
      throw new ForbiddenException(
        'Not authorized to view stats for this organization',
      );
    }

    // Create a modified requesting user for the stats
    const modifiedReqUser = {
      ...req.user,
      orgId: orgId,
    };

    return this.usersService.getUserStats(modifiedReqUser);
  }

  @Get(':id/users/stats/by-role')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  getOrganizationUserStatsByRole(@Param('id') id: string, @Request() req) {
    const orgId = +id;

    // Check if user has access to this organization
    if (req.user.role === UserRole.CLIENT_ADMIN && req.user.orgId !== orgId) {
      throw new ForbiddenException(
        'Not authorized to view stats for this organization',
      );
    }

    // Create a modified requesting user for the stats
    const modifiedReqUser = {
      ...req.user,
      orgId: orgId,
    };

    return this.usersService.getUserStatsByRole(modifiedReqUser);
  }

  // Manager endpoints for organization
  @Get(':id/managers/:managerId/team')
  @Roles(UserRole.MANAGER)
  async getManagerTeamInOrganization(
    @Param('id') id: string,
    @Param('managerId') managerId: string,
    @Request() req,
    @Res() res: Response,
  ) {
    const orgId = +id;
    const managerIdNum = +managerId;

    // Manager can only see their own team
    if (managerIdNum !== req.user.userId) {
      throw new ForbiddenException('Not authorized to view this team');
    }

    // Verify manager is in the specified organization
    if (req.user.orgId !== orgId) {
      throw new ForbiddenException('Manager not in specified organization');
    }

    // This will now only return organization learners (excludes individual learners)
    const team = await this.usersService.findByManager(managerIdNum);

    // Return 204 No Content if no results found
    if (team.length === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    return res.status(HttpStatus.OK).json(team);
  }

  // Organization user statistics endpoints
  @Get(':id/users/count')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  async getOrganizationUserCount(@Param('id') id: string, @Request() req) {
    const orgId = +id;

    // Check if user has access to this organization
    if (req.user.role === UserRole.CLIENT_ADMIN && req.user.orgId !== orgId) {
      throw new ForbiddenException(
        'Not authorized to view user count for this organization',
      );
    }

    const userCount = await this.organizationsService.getUserCount(orgId);
    return {
      org_id: orgId,
      user_count: userCount,
    };
  }

  @Get(':id/users/count/by-role')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  async getOrganizationUserCountByRole(
    @Param('id') id: string,
    @Request() req,
  ) {
    const orgId = +id;

    // Check if user has access to this organization
    if (req.user.role === UserRole.CLIENT_ADMIN && req.user.orgId !== orgId) {
      throw new ForbiddenException(
        'Not authorized to view user statistics for this organization',
      );
    }

    const userCountByRole =
      await this.organizationsService.getUserCountByRole(orgId);
    return {
      org_id: orgId,
      user_count_by_role: userCountByRole,
    };
  }

  // Organization statistics endpoint
  @Get(':id/statistics')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  async getOrganizationStatistics(@Param('id') id: string, @Request() req) {
    const orgId = +id;

    // Check if user has access to this organization
    if (req.user.role === UserRole.CLIENT_ADMIN && req.user.orgId !== orgId) {
      throw new ForbiddenException(
        'Not authorized to view statistics for this organization',
      );
    }

    const statistics =
      await this.organizationsService.getOrganizationStatistics(orgId);

    if (!statistics) {
      throw new NotFoundException('Organization not found');
    }

    return statistics;
  }
}
