import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { DomainModulesService } from './domain-modules.service';
import { LinkDomainModulesDto } from './dto/link-domain-modules.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorator/roles.decorator';
import { UserRole } from '../common/constants/user-roles';

@Controller({ path: 'domains', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class DomainModulesController {
  constructor(private readonly domainModulesService: DomainModulesService) {}

  // Bulk operations with body
  @Post(':id/modules/link')
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async linkModules(
    @Param('id', ParseIntPipe) id: number,
    @Body() linkDto: LinkDomainModulesDto,
  ) {
    return this.domainModulesService.linkModules(id, linkDto.moduleIds);
  }


  @Get(':id/modules')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  async getDomainModules(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const modules = await this.domainModulesService.getDomainModules(id);

    // Return 204 No Content if no modules linked
    if (modules.length === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    return res.status(HttpStatus.OK).json(modules);
  }

  @Get(':id/modules/:moduleId')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  async getDomainModule(
    @Param('id', ParseIntPipe) id: number,
    @Param('moduleId', ParseIntPipe) moduleId: number,
  ) {
    return this.domainModulesService.getDomainModule(id, moduleId);
  }
}

