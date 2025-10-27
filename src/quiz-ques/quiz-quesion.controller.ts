/*
https://docs.nestjs.com/controllers#controllers
*/

import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { QuizQuestionService } from './quiz-question.service';
import { AssignQuestionsDto, CreateQuizQuestionDto } from './dtos/create-quiz-ques.dto';
import { UserRole } from 'src/common/constants/user-roles';
import { Roles } from 'src/common/decorator/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UnassignOptionsDto, UpdateQuizQuestionDto } from './dtos/update-ques.dto';

@Controller({ path: 'quiz-ques', version: '1' })
export class QuizQuesionController {
constructor(private readonly quizQuestionService: QuizQuestionService) {}

@UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateQuizQuestionDto) {
    return this.quizQuestionService.create(dto);
  }

 @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @Post('assign')
  assignQuestions(@Body() dto: AssignQuestionsDto) {
    return this.quizQuestionService.assignQuestions(dto);
  }

  @Get('all/:quizId')
  findByQuiz(@Param('quizId') quizId: string) {
    return this.quizQuestionService.findQuestionsByQuiz(+quizId);
  }

  @Patch(':id')
  @Roles(UserRole.PLATFORM_ADMIN)
  async updateQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateQuizQuestionDto,
  ) {
    return this.quizQuestionService.updateQuestion(id, dto);
  }

   // Unassign specific options (or all if body empty)
  @Patch(':id/unassign-options')
  @Roles(UserRole.PLATFORM_ADMIN)
  async unassignOptions(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UnassignOptionsDto,
  ) {
    return this.quizQuestionService.unassignOptionsFromQuestion(
      id,
      body?.option_ids,
    );
  }

  // Safe delete question (removes associations first)
  @Delete(':id')
  @Roles(UserRole.PLATFORM_ADMIN)
  async deleteQuestion(@Param('id', ParseIntPipe) id: number) {
    return this.quizQuestionService.deleteQuestion(id);
  }

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
@Get(':id')
async getQuestionById(@Param('id') id: number) {
  return this.quizQuestionService.getQuestionById(id);
}
}
