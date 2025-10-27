/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';
import { QuizQuestion } from './quiz-question.entity';
import { QuizController } from 'src/quiz/quiz.controller';
import { QuizService } from 'src/quiz/quiz.service';
import { QuizQuestionService } from './quiz-question.service';
import { QuizQuesionController } from './quiz-quesion.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChangelogModule } from 'src/changelog/changelog.module';
import { Quiz } from 'src/quiz/quiz.entity';
import { QuizModule } from 'src/quiz/quiz.module';
import { QuizQuestionOption } from 'src/quiz-ques-options/quiz-question-options.entity';

@Module({
  imports: [
     TypeOrmModule.forFeature([
            QuizQuestion,
            Quiz,
            QuizQuestionOption
          ]),
          ChangelogModule,
          QuizModule
  ],
  controllers: [QuizQuesionController],
  providers: [QuizQuestionService],
  exports: [QuizQuestionService]
})
export class QuizQuestionModule {}
