import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainModulesService } from './domain-modules.service';
import { DomainModulesController } from './domain-modules.controller';
import { DomainModule } from './entities/domain-module.entity';
import { Domain } from '../domains/entities/domain.entity';
import { Module as ModuleEntity } from '../modules/entities/module.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DomainModule, Domain, ModuleEntity])],
  controllers: [DomainModulesController],
  providers: [DomainModulesService],
  exports: [DomainModulesService],
})
export class DomainModulesModule {}

