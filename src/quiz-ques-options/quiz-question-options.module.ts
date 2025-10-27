/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';
import { QuizQuestionOption } from './quiz-question-options.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChangelogModule } from 'src/changelog/changelog.module';
import { QuizQuestionOptionsController } from './quiz-question-options.controller';
import { QuizQuestion } from 'src/quiz-ques/quiz-question.entity';
import { QuizQuestionModule } from 'src/quiz-ques/quiz-question.module';
import { QuizquestionOptionsService } from './quiz-question-options.service';

@Module({
  imports: [
       TypeOrmModule.forFeature([
              QuizQuestionOption,
              QuizQuestion
            ]),
            ChangelogModule,
            QuizQuestionModule,
            QuizquestionOptionsModule
    ],
    controllers: [QuizQuestionOptionsController],
    providers: [QuizquestionOptionsService],
    exports: [QuizquestionOptionsService]
})
export class QuizquestionOptionsModule {}
