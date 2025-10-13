import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModulesService } from './modules.service';
import { ModulesController } from './modules.controller';
import { Module as ModuleEntity } from './entities/module.entity';
import { DomainModule } from './entities/domain-module.entity';
import { Domain } from '../domains/entities/domain.entity';
import { UserModulesModule } from '../user-modules/user-modules.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ModuleEntity, DomainModule, Domain]),
    UserModulesModule,
  ],
  controllers: [ModulesController],
  providers: [ModulesService],
  exports: [ModulesService],
})
export class ModulesModule {}
