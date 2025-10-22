import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModuleTopicsService } from './module-topics.service';
import { ModuleTopicsController } from './module-topics.controller';
import { ModuleTopic } from './entities/module-topic.entity';
import { Module as ModuleEntity } from '../modules/entities/module.entity';
import { Topic } from '../topics/entities/topic.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ModuleTopic, ModuleEntity, Topic])],
  controllers: [ModuleTopicsController],
  providers: [ModuleTopicsService],
  exports: [ModuleTopicsService],
})
export class ModuleTopicsModule {}



