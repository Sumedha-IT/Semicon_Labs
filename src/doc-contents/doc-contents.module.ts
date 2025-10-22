import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocContentsController } from './doc-contents.controller';
import { DocContentsService } from './doc-contents.service';
import { DocContent } from './entities/doc-content.entity';
import { Topic } from '../topics/entities/topic.entity';
import { FileStorageService } from './utils/file-storage.util';
import { ChangelogModule } from '../changelog/changelog.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocContent, Topic]),
    ChangelogModule,
  ],
  controllers: [DocContentsController],
  providers: [DocContentsService, FileStorageService],
  exports: [DocContentsService],
})
export class DocContentsModule {}

