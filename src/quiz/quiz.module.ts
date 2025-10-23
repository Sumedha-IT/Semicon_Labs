import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizService } from './quiz.service';
import { Module } from '@nestjs/common';
import { Quiz } from './quiz.entity';
import { ChangelogModule } from 'src/changelog/changelog.module';
import { QuizController } from './quiz.controller';

@Module({
  imports: [
      TypeOrmModule.forFeature([
        Quiz,
      ]),
      ChangelogModule,
    ],
    controllers: [QuizController],
    providers: [QuizService],
    exports: [QuizService],
})
export class QuizModule {}
