import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChangelogService } from './changelog.service';
import { ChangelogController } from './changelog.controller';
import { ChangeLog } from './entities/changelog.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ChangeLog])],
  controllers: [ChangelogController],
  providers: [ChangelogService],
  exports: [ChangelogService], // Export so other modules can use it
})
export class ChangelogModule {}

