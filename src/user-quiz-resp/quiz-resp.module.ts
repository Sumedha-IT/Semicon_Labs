/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChangelogModule } from 'src/changelog/changelog.module';
import { Quiz } from 'src/quiz/quiz.entity';
import { QuizModule } from 'src/quiz/quiz.module';
import { UserQuizResponse } from './user-quiz-response.entity';
import { QuizAttemptController } from './quiz-resp.controller';
import { QuizAttemptService } from './quiz-resp.service';
import { QuizQuestionOption } from 'src/quiz-ques-options/quiz-question-options.entity';
import { QuizQuestion } from 'src/quiz-ques/quiz-question.entity';
import { UserModule } from 'src/user-modules/entities/user-module.entity';

@Module({
  imports: [
     TypeOrmModule.forFeature([
            QuizQuestion,
            QuizQuestionOption,
            Quiz,
            UserQuizResponse,
            UserModule
          ]),
          ChangelogModule,
          QuizModule
  ],
  controllers: [QuizAttemptController],
  providers: [QuizAttemptService],
  exports: [QuizAttemptService]
})
export class UserQuizResponseModule {}
