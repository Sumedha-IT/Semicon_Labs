import { Controller, Get, Query, UseGuards, Request, Post, Body, Patch, Param, Delete, HttpStatus, HttpCode, BadRequestException, Res } from '@nestjs/common';
import { Response } from 'express';
import { UsersService } from './users.service';
import { UserModulesService } from '../user-modules/user-modules.service';
import { UserQueryDto } from './dto/user-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorator/roles.decorator';
import { UserRole } from '../common/constants/user-roles';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateIndividualUserDto } from './dto/create-individual-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Public } from '../common/decorator/public.decorator';
import { UserDomainsService } from '../user-domains/user-domains.service';
import { LinkUserToDomainsDto } from '../user-domains/dto/link-user-to-domains.dto';
import { EnrollModuleDto, UserModuleQueryDto, UpdateUserModuleDto } from '../user-modules/dto/user-module.dto';

@Controller({ path: 'users', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersV1Controller {
  constructor(
    private readonly usersService: UsersService,
    private readonly userDomainsService: UserDomainsService,
    private readonly userModulesService: UserModulesService,
  ) {}

  // Universal registration endpoint
  // Public for individual learners (org_id not provided or null)
  // Requires authentication for organizational users (org_id provided)
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() createUserDto: CreateUserDto) {
    // If no org_id provided or org_id is null, treat as individual learner registration
    if (!createUserDto.org_id) {
      // Force individual learner fields
      const individualUserData = {
        ...createUserDto,
        org_id: null as any,
        manager_id: null as any,
        role: UserRole.LEARNER
      };
      const user = await this.usersService.create(individualUserData);
      return { user_id: user.user_id };
    }
    
    // For organizational users (org_id provided), create normally
    const user = await this.usersService.create(createUserDto);
    return { user_id: user.user_id };
  }

  // Protected endpoint - Create users with role-based permissions:
  // - Platform Admin: Can create ClientAdmin, Manager, Learner (any organization)
  // - ClientAdmin: Can create Manager, Learner (only their own organization)
  @Post()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto, @Request() req) {
    const requestingUser = req.user;
    
    // If ClientAdmin is creating a user
    if (requestingUser.role === UserRole.CLIENT_ADMIN) {
      // ClientAdmin cannot create another ClientAdmin
      if (createUserDto.role === UserRole.CLIENT_ADMIN) {
        throw new BadRequestException('ClientAdmin cannot create another ClientAdmin. Only Platform Admin can create ClientAdmin roles.');
      }
      
      // ClientAdmin cannot create Platform Admin
      if (createUserDto.role === UserRole.PLATFORM_ADMIN) {
        throw new BadRequestException('ClientAdmin cannot create Platform Admin.');
      }
      
      // ClientAdmin can only create users in their own organization
      if (!createUserDto.org_id || createUserDto.org_id !== requestingUser.orgId) {
        throw new BadRequestException(`ClientAdmin can only create users in their own organization (org_id: ${requestingUser.orgId}).`);
      }
    }
    
    const user = await this.usersService.create(createUserDto);
    return { user_id: user.user_id };
  }

  // Get all users with comprehensive pagination and filtering
  @Get()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  async findAll(
    @Query() queryDto: UserQueryDto,
    @Request() req,
    @Res() res: Response
  ) {
    console.log('Users endpoint - req.user:', JSON.stringify(req.user, null, 2));
    const result = await this.usersService.findUsersWithPagination(queryDto, req.user);
    
    // Return 204 No Content if no results found
    if (result.pagination.total === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }
    
    return res.status(HttpStatus.OK).json(result);
  }

  // Admin endpoint to get all user-module enrollments with filters
  // IMPORTANT: This must come BEFORE @Get(':id') to avoid route conflicts
  @Get('enrollments')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  async getAllEnrollments(@Query() queryDto: UserModuleQueryDto, @Res() res: Response) {
    const result = await this.userModulesService.findAllEnrollments(queryDto);
    
    // Return 204 No Content if no results found
    if (result.total === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }
    
    return res.status(HttpStatus.OK).json(result);
  }

  // Search users
  // IMPORTANT: This must come BEFORE @Get(':id') to avoid route conflicts
  @Get('search/:query')
  @Roles(UserRole.PLATFORM_ADMIN)
  searchUsers(@Param('query') query: string, @Request() req) {
    return this.usersService.searchUsers(query, req.user);
  }

  // Filter by role
  // IMPORTANT: This must come BEFORE @Get(':id') to avoid route conflicts
  @Get('filter/role/:role')
  @Roles(UserRole.PLATFORM_ADMIN)
  filterByRole(@Param('role') role: string, @Request() req) {
    return this.usersService.filterByRole(role, req.user);
  }

  // Filter by organization
  // IMPORTANT: This must come BEFORE @Get(':id') to avoid route conflicts
  @Get('filter/organization/:orgId')
  @Roles(UserRole.PLATFORM_ADMIN)
  filterByOrganization(@Param('orgId') orgId: string, @Request() req) {
    return this.usersService.filterByOrganization(+orgId, req.user);
  }

  // Stats endpoints
  // IMPORTANT: These must come BEFORE @Get(':id') to avoid route conflicts
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
  // IMPORTANT: These must come BEFORE @Get(':id') to avoid route conflicts
  @Get('profile/me')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.LEARNER)
  getMyProfile(@Request() req) {
    if (!req.user.userId || isNaN(req.user.userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    return this.usersService.findOne(req.user.userId);
  }

  @Patch('profile/me')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.LEARNER)
  @HttpCode(HttpStatus.OK)
  async updateMyProfile(@Body() updateUserDto: UpdateUserDto, @Request() req) {
    if (!req.user.userId || isNaN(req.user.userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    await this.usersService.update(req.user.userId, updateUserDto);
    return { user_id: req.user.userId };
  }

  // Password management
  // IMPORTANT: These must come BEFORE @Get(':id') to avoid route conflicts
  @Patch('change-password')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.LEARNER)
  @HttpCode(HttpStatus.OK)
  changePassword(@Body() passwordData: { currentPassword: string; newPassword: string }, @Request() req) {
    if (!req.user.userId || isNaN(req.user.userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    return this.usersService.changePassword(req.user.userId, passwordData.currentPassword, passwordData.newPassword);
  }

  @Post('reset-password')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() resetData: { userId: number; newPassword: string }, @Request() req) {
    return this.usersService.resetPassword(resetData.userId, resetData.newPassword, req.user);
  }

  // Individual learners list (admin only)
  // IMPORTANT: This must come BEFORE @Get(':id') to avoid route conflicts
  @Get('individual-learners')
  @Roles(UserRole.PLATFORM_ADMIN)
  getIndividualLearners() {
    return this.usersService.findIndividualLearners();
  }

  // Get one user by id
  // IMPORTANT: Parameterized routes like :id MUST come AFTER all specific routes
  @Get(':id')
  @Roles(UserRole.PLATFORM_ADMIN)
  findOne(@Param('id') id: string) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    return this.usersService.findOne(userId);
  }

  // Update user by id
  // - Platform Admin: Can update any user in any organization
  // - ClientAdmin: Can update Manager, Learner in their own organization only
  @Patch(':id')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN)
  @HttpCode(HttpStatus.OK)
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Request() req) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const requestingUser = req.user;
    
    // If ClientAdmin is updating a user
    if (requestingUser.role === UserRole.CLIENT_ADMIN) {
      // Get the user being updated
      const userToUpdate = await this.usersService.findOne(userId);
      
      if (!userToUpdate) {
        throw new BadRequestException('User not found');
      }
      
      // ClientAdmin can only update users in their own organization
      if (userToUpdate.org_id !== requestingUser.orgId) {
        throw new BadRequestException(`ClientAdmin can only update users in their own organization (org_id: ${requestingUser.orgId}).`);
      }
      
      // ClientAdmin cannot update ClientAdmin or Platform Admin
      if (userToUpdate.role === UserRole.CLIENT_ADMIN || userToUpdate.role === UserRole.PLATFORM_ADMIN) {
        throw new BadRequestException(`ClientAdmin cannot update ${userToUpdate.role} users.`);
      }
      
      // ClientAdmin cannot change role to ClientAdmin or Platform Admin
      if (updateUserDto.role === UserRole.CLIENT_ADMIN || updateUserDto.role === UserRole.PLATFORM_ADMIN) {
        throw new BadRequestException(`ClientAdmin cannot update user role to ${updateUserDto.role}.`);
      }
      
      // If updating org_id, ensure it's still their organization
      if (updateUserDto.org_id && updateUserDto.org_id !== requestingUser.orgId) {
        throw new BadRequestException(`ClientAdmin cannot move users to other organizations.`);
      }
    }
    
    await this.usersService.update(userId, updateUserDto);
    return { user_id: userId };
  }

  // Debug endpoint to check user status
  @Get(':id/debug')
  @Roles(UserRole.PLATFORM_ADMIN)
  async debugUser(@Param('id') id: string) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    return this.usersService.debugUser(userId);
  }

  // Delete user by id
  @Delete(':id')
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    return this.usersService.remove(userId).then((result) => {
      if (!result.success) {
        if (result.message === 'User not found') {
          throw new BadRequestException(result.message);
        }
        if (result.message === 'User is already deleted') {
          throw new BadRequestException(result.message);
        }
        if (result.message?.startsWith('Cannot delete manager.')) {
          // Manager has active learners
          throw new BadRequestException(result.message);
        }
        if (result.message?.startsWith('Cannot delete ClientAdmin.')) {
          throw new BadRequestException(result.message);
        }
      }
      return result; // { success: true, message: 'User soft deleted successfully.' }
    });
  }

  // Domain linking endpoints (v1)
  @Post(':id/domains')
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async linkDomains(@Param('id') id: string, @Body() body: LinkUserToDomainsDto) {
    const userId = parseInt(id, 10);
    
    if (isNaN(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    
    // This will throw NotFoundException if user doesn't exist
    const result = await this.userDomainsService.link(userId, body.domainIds);
    
    // Calculate unique domain IDs from request
    const uniqueRequestedIds = [...new Set(body.domainIds)];
    
    // If there are invalid domains, return error with complete information
    if (result.invalid.length > 0) {
      const errorMessages: string[] = [];
      errorMessages.push(`Invalid domain(s) - do not exist: [${result.invalid.join(', ')}]`);
      
      if (result.duplicates && result.duplicates.length > 0) {
        errorMessages.push(`Duplicate domain IDs found in request: [${[...new Set(result.duplicates)].join(', ')}]`);
      }
      
      if (result.skipped.length > 0) {
        errorMessages.push(`Domain(s) already linked to user ${userId}: [${result.skipped.join(', ')}]`);
      }
      
      if (result.linked.length > 0) {
        errorMessages.push(`Successfully linked ${result.linked.length} domain(s): [${result.linked.join(', ')}]`);
      }
      
      throw new BadRequestException({
        message: errorMessages.join('. '),
        invalidDomains: result.invalid,
        duplicateDomains: result.duplicates ? [...new Set(result.duplicates)] : undefined,
        alreadyLinked: result.skipped,
        successfullyLinked: result.linked,
        validationError: true
      });
    }
    
    // Build detailed message for successful operations
    let message = '';
    const messages: string[] = [];
    
    if (result.linked.length > 0) {
      messages.push(`Successfully linked ${result.linked.length} domain(s): [${result.linked.join(', ')}]`);
    }
    
    if (result.skipped.length > 0) {
      messages.push(`Skipped ${result.skipped.length} domain(s) - already linked to user ${userId}: [${result.skipped.join(', ')}]`);
    }
    
    if (result.duplicates && result.duplicates.length > 0) {
      messages.push(`Note: ${result.duplicates.length} duplicate ID(s) were removed from request: [${[...new Set(result.duplicates)].join(', ')}]`);
    }
    
    message = messages.join('. ');
    
    return {
      success: true,
      message,
      userId,
      linked: result.linked,
      skipped: result.skipped,
      duplicates: result.duplicates ? [...new Set(result.duplicates)] : undefined,
      totalRequested: body.domainIds.length,
      totalUnique: uniqueRequestedIds.length,
      totalLinked: result.linked.length,
      totalSkipped: result.skipped.length
    };
  }

  @Get(':id/domains')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  async listUserDomains(@Param('id') id: string) {
    const userId = parseInt(id, 10);
    
    if (isNaN(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    
    // This will throw NotFoundException if user doesn't exist
    return this.userDomainsService.listUserDomains(userId);
  }

  @Delete(':id/domains/:domainId')
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async unlinkDomain(@Param('id') id: string, @Param('domainId') domainId: string) {
    const userId = parseInt(id, 10);
    const did = parseInt(domainId, 10);
    
    if (isNaN(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    
    if (isNaN(did)) {
      throw new BadRequestException('Invalid domain ID');
    }
    
    // This will throw NotFoundException if user doesn't exist
    const result = await this.userDomainsService.unlink(userId, did);
    
    if (!result.success) {
      throw new BadRequestException(result.message);
    }
    
    return {
      success: true,
      message: result.message
    };
  }

  // User-centric module operations

  @Post(':id/modules/enroll')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.LEARNER)
  @HttpCode(HttpStatus.CREATED)
  async enrollInModule(
    @Param('id') id: string, 
    @Body() enrollDto: EnrollModuleDto,
    @Request() req
  ) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    
    // Learners can only enroll themselves
    if (req.user.role === UserRole.LEARNER && req.user.userId !== userId) {
      throw new BadRequestException('Learners can only enroll themselves in modules');
    }
    
    return this.userModulesService.enroll(userId, enrollDto);
  }

  @Get(':id/modules/available')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.LEARNER)
  async getAvailableModules(
    @Param('id') id: string,
    @Query() queryDto: UserModuleQueryDto,
    @Request() req,
    @Res() res: Response
  ) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    
    // Learners can only view their own available modules
    if (req.user.role === UserRole.LEARNER && req.user.userId !== userId) {
      throw new BadRequestException('Learners can only view their own available modules');
    }
    
    const result = await this.userModulesService.getAvailableModules(userId, queryDto);
    
    // Return 204 No Content if no results found
    if (result.total === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }
    
    return res.status(HttpStatus.OK).json(result);
  }

  @Get(':id/modules/:moduleId')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.LEARNER)
  async getUserModule(
    @Param('id') id: string,
    @Param('moduleId') moduleId: string
  ) {
    const userId = parseInt(id, 10);
    const modId = parseInt(moduleId, 10);
    if (isNaN(userId) || isNaN(modId)) {
      throw new BadRequestException('Invalid user ID or module ID');
    }
    return this.userModulesService.getUserModule(userId, modId);
  }

  @Get(':id/modules')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.LEARNER)
  async getUserModules(
    @Param('id') id: string,
    @Query() queryDto: UserModuleQueryDto,
    @Request() req,
    @Res() res: Response
  ) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    
    // Learners can only view their own modules
    if (req.user.role === UserRole.LEARNER && req.user.userId !== userId) {
      throw new BadRequestException('Learners can only view their own modules');
    }
    
    const result = await this.userModulesService.getUserModules(userId, queryDto);
    
    // Return 204 No Content if no results found
    if (result.total === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }
    
    return res.status(HttpStatus.OK).json(result);
  }

  @Patch(':id/modules/:moduleId')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async updateUserModule(
    @Param('id') id: string,
    @Param('moduleId') moduleId: string,
    @Body() updateDto: UpdateUserModuleDto
  ) {
    const userId = parseInt(id, 10);
    const modId = parseInt(moduleId, 10);
    if (isNaN(userId) || isNaN(modId)) {
      throw new BadRequestException('Invalid user ID or module ID');
    }
    return this.userModulesService.updateUserModule(userId, modId, updateDto);
  }

  @Delete(':id/modules/:moduleId')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async unenrollFromModule(
    @Param('id') id: string,
    @Param('moduleId') moduleId: string
  ) {
    const userId = parseInt(id, 10);
    const modId = parseInt(moduleId, 10);
    if (isNaN(userId) || isNaN(modId)) {
      throw new BadRequestException('Invalid user ID or module ID');
    }
    return this.userModulesService.unenrollByUserAndModule(userId, modId);
  }
}
