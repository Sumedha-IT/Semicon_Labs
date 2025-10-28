import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ModuleUsersService } from './module-users.service';
import { ModuleUserQueryDto } from './dto/user-module.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorator/roles.decorator';
import { UserRole } from '../common/constants/user-roles';

@Controller({ path: 'modules', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class ModuleUsersController {
  constructor(private readonly moduleUsersService: ModuleUsersService) {}

  // Module-centric enrollment has been removed to avoid confusion
  // Use user-centric endpoint instead: POST /v1/users/:userId/modules/:moduleId
  
  @Get(':id/users')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  async getModuleUsers(
    @Param('id') id: string,
    @Query() queryDto: ModuleUserQueryDto,
    @Res() res: Response,
  ) {
    const moduleId = parseInt(id, 10);
    if (isNaN(moduleId)) {
      throw new BadRequestException('Invalid module ID');
    }
    const result = await this.moduleUsersService.getModuleUsers(
      moduleId,
      queryDto,
    );

    // Return 204 No Content if no data in response
    if (result.data.length === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    return res.status(HttpStatus.OK).json(result);
  }

}

