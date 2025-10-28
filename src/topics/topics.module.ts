import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TopicsService } from './topics.service';
import { TopicsController } from './topics.controller';
import { Topic } from './entities/topic.entity';
import { ModuleTopic } from '../module-topics/entities/module-topic.entity';
import { Module as ModuleEntity } from '../modules/entities/module.entity';
import { DocContent } from '../doc-contents/entities/doc-content.entity';
import { FileStorageService } from '../doc-contents/utils/file-storage.util';
import { ChangelogModule } from '../changelog/changelog.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Topic,
      ModuleTopic,
      ModuleEntity,
      DocContent,
    ]),
    ChangelogModule,
  ],
  controllers: [TopicsController],
  providers: [TopicsService, FileStorageService],
  exports: [TopicsService],
})
export class TopicsModule {}
