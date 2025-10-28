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
  HttpCode,
  HttpStatus,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ModuleUsersService } from './module-users.service';
import { ModuleUserQueryDto } from './dto/user-module.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorator/roles.decorator';
import { UserRole } from '../common/constants/user-roles';

@Controller({ path: 'user-modules', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserModulesController {
  constructor(private readonly moduleUsersService: ModuleUsersService) {}

  @Get('modules/:moduleId/users')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  async getModuleUsers(
    @Param('moduleId') moduleId: string,
    @Query() queryDto: ModuleUserQueryDto,
    @Res() res: Response,
  ) {
    const modId = parseInt(moduleId, 10);

    if (isNaN(modId)) {
      throw new BadRequestException('Invalid module ID');
    }

    const result = await this.moduleUsersService.getModuleUsers(modId, queryDto);

    // Return 204 No Content if no users found
    if (result.data.length === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    return res.status(HttpStatus.OK).json(result);
  }
}
