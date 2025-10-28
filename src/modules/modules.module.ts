import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModulesService } from './modules.service';
import { ModulesController } from './modules.controller';
import { Module as ModuleEntity } from './entities/module.entity';
import { DomainModule } from '../domain-modules/entities/domain-module.entity';
import { Domain } from '../domains/entities/domain.entity';
import { UserModule } from '../user-modules/entities/user-module.entity';
import { UserDomain } from '../user-domains/entities/user-domain.entity';
import { User } from '../users/entities/user.entity';
import { ChangelogModule } from '../changelog/changelog.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ModuleEntity, DomainModule, Domain, UserModule, UserDomain, User]),
    ChangelogModule,
  ],
  controllers: [ModulesController],
  providers: [ModulesService],
  exports: [ModulesService],
})
export class ModulesModule {}
