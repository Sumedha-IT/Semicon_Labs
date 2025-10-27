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
import { ReasonDto, UnassignOptionsDto, UpdateQuizQuestionDto } from './dtos/update-ques.dto';
import { GetUser } from 'src/common/decorator/get-user.decorator';

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
    @GetUser('userId') userId: number,
  ) {
    return this.quizQuestionService.updateQuestion(id, dto, userId);
  }

   // Unassign specific options (or all if body empty)
  @Patch(':id/unassign-options')
  @Roles(UserRole.PLATFORM_ADMIN)
  async unassignOptions(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UnassignOptionsDto,
    @GetUser('userId') userId: number,
  ) {
    return this.quizQuestionService.unassignOptionsFromQuestion(
      id,
      userId,
      body.reason,
      body?.option_ids,
    );
  }

  // Safe delete question (removes associations first)
  @Delete(':id')
  @Roles(UserRole.PLATFORM_ADMIN)
  async deleteQuestion(@Param('id', ParseIntPipe) id: number, @GetUser('userId') userId: number,@Body() body: ReasonDto) {
    return this.quizQuestionService.deleteQuestion(id, userId, body.reason);
  }

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
@Get(':id')
async getQuestionById(@Param('id') id: number) {
  return this.quizQuestionService.getQuestionById(id);
}
}
