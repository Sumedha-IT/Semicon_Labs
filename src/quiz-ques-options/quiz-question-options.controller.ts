/*
https://docs.nestjs.com/controllers#controllers
*/

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AssignOptionsDto, OptionDto } from './dtos/create-quizques-opt.dto';
import { QuizquestionOptionsService } from './quiz-question-options.service';
import { UserRole } from 'src/common/constants/user-roles';
import { Roles } from 'src/common/decorator/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UpdateQuizOptionDto } from './dtos/update-quiz.dto';

@Controller({ path: 'ques-opt', version: '1' })
export class QuizQuestionOptionsController {
  constructor(private readonly quizOptionService: QuizquestionOptionsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: OptionDto) {
    return this.quizOptionService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @Post('assign-options')
  async assignOptions(@Body() dto: AssignOptionsDto) {
    return this.quizOptionService.assignOptions(dto);
  }

  @Get('all/:questionId')
  findByQuestion(@Param('questionId') questionId: string) {
    return this.quizOptionService.findOptionsByQuestion(+questionId);
  }

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
@Get(':id')
async getOptionById(@Param('id') id: number) {
  return this.quizOptionService.getOptionById(id);
}


  @Patch(':id')
  @Roles(UserRole.PLATFORM_ADMIN)
  async updateOption(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateQuizOptionDto,
  ) {
    return this.quizOptionService.updateOption(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.PLATFORM_ADMIN)
  async deleteOption(@Param('id', ParseIntPipe) id: number) {
    return this.quizOptionService.deleteOption(id);
  }
}
