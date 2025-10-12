import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ModulesService } from './modules.service';
import { ModuleUsersService } from '../user-modules/module-users.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ModuleQueryDto } from './dto/module-query.dto';
import { EnrollUserDto, ModuleUserQueryDto } from '../user-modules/dto/user-module.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorator/roles.decorator';
import { Public } from '../common/decorator/public.decorator';
import { UserRole } from '../common/constants/user-roles';

@Controller({ path: 'modules', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class ModulesController {
  constructor(
    private readonly modulesService: ModulesService,
    private readonly moduleUsersService: ModuleUsersService,
  ) {}

  @Post()
  @Roles('PlatformAdmin')
  async create(@Body() createModuleDto: CreateModuleDto) {
    return await this.modulesService.create(createModuleDto);
  }

  @Get()
  @Roles('PlatformAdmin', 'ClientAdmin', 'Manager', 'Learner') 
  async findAll(@Query() query: ModuleQueryDto, @Res() res: Response) {
    const result = await this.modulesService.findAll(query);
    
    // Return 204 No Content if no results found
    if (result.total === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }
    
    return res.status(HttpStatus.OK).json(result);
  }

  @Get(':id')
  @Roles('PlatformAdmin', 'ClientAdmin', 'Manager', 'Learner')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.modulesService.findOne(id);
  }

  @Patch(':id')
  @Roles('PlatformAdmin')
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateModuleDto: UpdateModuleDto) {
    return await this.modulesService.update(id, updateModuleDto);
  }

  @Delete(':id')
  @Roles('PlatformAdmin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.modulesService.remove(id);
  }

  // Module-centric user operations
  @Post(':id/users/enroll')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  async enrollUserInModule(
    @Param('id') id: string,
    @Body() enrollDto: EnrollUserDto
  ) {
    const moduleId = parseInt(id, 10);
    if (isNaN(moduleId)) {
      throw new BadRequestException('Invalid module ID');
    }
    return this.moduleUsersService.enrollUserInModule(moduleId, enrollDto);
  }

  @Get(':id/users')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  async getModuleUsers(
    @Param('id') id: string,
    @Query() queryDto: ModuleUserQueryDto,
    @Res() res: Response
  ) {
    const moduleId = parseInt(id, 10);
    if (isNaN(moduleId)) {
      throw new BadRequestException('Invalid module ID');
    }
    const result = await this.moduleUsersService.getModuleUsers(moduleId, queryDto);
    
    // Return 204 No Content if no results found
    if (result.total === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }
    
    return res.status(HttpStatus.OK).json(result);
  }

  @Get(':id/users/passed')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  async getPassedUsers(@Param('id') id: string, @Res() res: Response) {
    const moduleId = parseInt(id, 10);
    if (isNaN(moduleId)) {
      throw new BadRequestException('Invalid module ID');
    }
    const result = await this.moduleUsersService.getPassedUsers(moduleId);
    
    // Return 204 No Content if no results found
    if (result.total === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }
    
    return res.status(HttpStatus.OK).json(result);
  }

  @Get(':id/users/failed')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  async getFailedUsers(@Param('id') id: string, @Res() res: Response) {
    const moduleId = parseInt(id, 10);
    if (isNaN(moduleId)) {
      throw new BadRequestException('Invalid module ID');
    }
    const result = await this.moduleUsersService.getFailedUsers(moduleId);
    
    // Return 204 No Content if no results found
    if (result.total === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }
    
    return res.status(HttpStatus.OK).json(result);
  }

  @Get(':id/stats')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  async getModuleStats(@Param('id') id: string) {
    const moduleId = parseInt(id, 10);
    if (isNaN(moduleId)) {
      throw new BadRequestException('Invalid module ID');
    }
    return this.moduleUsersService.getModuleStats(moduleId);
  }

  @Delete(':id/users/:userId')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async unenrollUserFromModule(
    @Param('id') id: string,
    @Param('userId') userId: string
  ) {
    const moduleId = parseInt(id, 10);
    const uid = parseInt(userId, 10);
    if (isNaN(moduleId) || isNaN(uid)) {
      throw new BadRequestException('Invalid module ID or user ID');
    }
    
    // Import and inject UserModulesService to call unenrollByUserAndModule
    // For now, this is a placeholder that needs the service
    return this.moduleUsersService.unenrollUser(uid, moduleId);
  }
}
