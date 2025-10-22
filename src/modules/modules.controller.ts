import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ModulesService } from './modules.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ModuleQueryDto } from './dto/module-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorator/roles.decorator';
import { GetUser } from '../common/decorator/get-user.decorator';

@Controller({ path: 'modules', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Post()
  @Roles('PlatformAdmin')
  async create(@Body() createModuleDto: CreateModuleDto) {
    return await this.modulesService.create(createModuleDto);
  }

  @Get()
  @Roles('PlatformAdmin', 'ClientAdmin', 'Manager', 'Learner')
  async findAll(@Query() query: ModuleQueryDto, @Res() res: Response) {
    const result = await this.modulesService.findAll(query);

    // Return 204 No Content if no data in response
    if (result.data.length === 0) {
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
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateModuleDto: UpdateModuleDto,
    @GetUser('userId') userId: number,
  ) {
    return await this.modulesService.update(id, updateModuleDto, userId);
  }

  // Note: Module deletion is not supported as modules are core entities
  // that should not be removed once created
}
