import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { DomainsService } from './domains.service';
import { CreateDomainDto } from './dto/create-domain.dto';
import { UpdateDomainDto } from './dto/update-domain.dto';
import { DomainQueryDto } from './dto/domain-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorator/roles.decorator';
import { GetUser } from '../common/decorator/get-user.decorator';
import { UserRole } from '../common/constants/user-roles';

@Controller({ path: 'domains', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Post()
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateDomainDto) {
    return this.domainsService.create(dto);
  }

  @Get()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  async findAll(@Query() query: DomainQueryDto, @Res() res: Response) {
    const result = await this.domainsService.findAll(query);

    // Return 204 No Content if no data in response
    if (result.data.length === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    return res.status(HttpStatus.OK).json(result);
  }

  @Get(':id')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  findOne(@Param('id') id: string) {
    return this.domainsService.findOne(+id);
  }

  @Patch(':id')
  @Roles(UserRole.PLATFORM_ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDomainDto,
    @GetUser('userId') userId: number,
  ) {
    return this.domainsService.update(+id, dto, userId);
  }

  // Note: Domain deletion is not supported as domains are core entities
  // that should not be removed once created

  // Domain-module operations (GET, POST, DELETE /v1/domains/:id/modules)
  // are handled by DomainModulesController to avoid routing conflicts
}
