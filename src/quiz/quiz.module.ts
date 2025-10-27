import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizService } from './quiz.service';

import { Quiz } from './quiz.entity';
import { ChangelogModule } from 'src/changelog/changelog.module';
import { QuizController } from './quiz.controller';
import { QuizQuestion } from 'src/quiz-ques/quiz-question.entity';
import { Module as ModuleEntity } from 'src/modules/entities/module.entity';
import { Module } from '@nestjs/common';

@Module({
  imports: [
      TypeOrmModule.forFeature([
        Quiz,
        QuizQuestion,
        ModuleEntity
      ]),
      ChangelogModule,
    ],
    controllers: [QuizController],
    providers: [QuizService],
    exports: [QuizService],
})
export class QuizModule {}
