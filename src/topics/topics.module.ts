import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TopicsService } from './topics.service';
import { TopicsController } from './topics.controller';
import { Topic } from './entities/topic.entity';
import { ModuleTopic } from '../module_topics/entities/module-topic.entity';
import { Module as ModuleEntity } from '../modules/entities/module.entity';
import { ChangelogModule } from '../changelog/changelog.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Topic,
      ModuleTopic,
      ModuleEntity,
    ]),
    ChangelogModule,
  ],
  controllers: [TopicsController],
  providers: [TopicsService],
  exports: [TopicsService],
})
export class TopicsModule {}
