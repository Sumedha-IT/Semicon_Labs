import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Delete,
  Put,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ToolService } from './tool.service';
import { CreateToolDto } from './dtos/create-tool.dto';
import { UpdateToolDto } from './dtos/update-tool.dto';
import { AssignToolDto, SwitchToolDto } from './dtos/assign-tool.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from 'src/common/constants/user-roles';
import { Roles } from 'src/common/decorator/roles.decorator';
import { GetUser } from 'src/common/decorator/get-user.decorator';


@Controller({ path: 'tool', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)

export class ToolController {
  constructor(private readonly toolService: ToolService) {}

  @Roles(UserRole.PLATFORM_ADMIN)
  @Post()
  createTool(@Body() dto: CreateToolDto) {
    return this.toolService.createTool(dto);
  }

  @Roles(UserRole.PLATFORM_ADMIN)
  @Patch(':id')
  updateTool(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateToolDto, @GetUser('userId') userId: number) {
    return this.toolService.updateTool(id, dto, userId);
  }

  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.LEARNER)
  @Get()
  getAllTools() {
    return this.toolService.getAllTools();
  }

  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.LEARNER)
  @Get(':id')
  getToolById(@Param('id', ParseIntPipe) id: number) {
    return this.toolService.getToolById(id);
  }

  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.LEARNER)
  @Get('name/:name')
  getToolByName(@Param('name') name: string) {
    return this.toolService.getToolByName(name);
  }

  // @Delete(':id')
  // deleteTool(@Param('id', ParseIntPipe) id: number) {
  //   return this.toolService.deleteTool(id);
  // }

  @Roles(UserRole.PLATFORM_ADMIN, UserRole.LEARNER)
  @Post('assign')
  assignToolToUser(@Body() dto: AssignToolDto, @GetUser('userId') userId: number,) {
    return this.toolService.assignToolToUser(dto);
  }

  @Roles(UserRole.PLATFORM_ADMIN, UserRole.LEARNER)
  @Post('switch')
  switchTool(@Body() dto: SwitchToolDto, @GetUser('userId') userId: number,) {
    return this.toolService.switchUserTool(dto, userId);
  }
}

