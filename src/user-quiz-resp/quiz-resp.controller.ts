import { Controller, Post, Body, Get, Param, ParseIntPipe } from '@nestjs/common';
import { QuizAttemptService } from './quiz-resp.service';
import { AttemptQuizDto } from './dtos/attempt-quiz.dto';


@Controller({ path: 'quiz-resp', version: '1' })
export class QuizAttemptController {
  constructor(private readonly quizAttemptService: QuizAttemptService) {}

  @Post('attempt')
  async attemptQuiz(@Body() dto: AttemptQuizDto) {
    return this.quizAttemptService.attemptQuiz(dto);
  }

  @Get('result/:user_id/:quiz_id')
async getQuizResult(
  @Param('user_id', ParseIntPipe) user_id: number,
  @Param('quiz_id', ParseIntPipe) quiz_id: number,
) {
  return this.quizAttemptService.getQuizResult(user_id, quiz_id);
}

}
