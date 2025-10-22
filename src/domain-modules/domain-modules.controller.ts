import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  BadRequestException,
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

  @Delete(':id/modules/link')
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async unlinkModules(
    @Param('id', ParseIntPipe) id: number,
    @Body() unlinkDto: LinkDomainModulesDto,
  ) {
    return this.domainModulesService.unlinkModules(id, unlinkDto.moduleIds);
  }

  // Single module operations (no body needed)
  @Post(':id/modules/:moduleId/link')
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async linkSingleModule(
    @Param('id', ParseIntPipe) id: number,
    @Param('moduleId', ParseIntPipe) moduleId: number,
  ) {
    return this.domainModulesService.linkModules(id, [moduleId]);
  }

  @Delete(':id/modules/:moduleId/link')
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async unlinkSingleModule(
    @Param('id', ParseIntPipe) id: number,
    @Param('moduleId', ParseIntPipe) moduleId: number,
  ) {
    return this.domainModulesService.unlinkModules(id, [moduleId]);
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

