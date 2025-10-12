import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModulesService } from './user-modules.service';
import { ModuleUsersService } from './module-users.service';
import { UserModule } from './entities/user-module.entity';
import { User } from '../users/entities/user.entity';
import { Module as ModuleEntity } from '../modules/entities/module.entity';
import { UserDomain } from '../user-domains/entities/user-domain.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserModule, User, ModuleEntity, UserDomain]),
  ],
  controllers: [],
  providers: [UserModulesService, ModuleUsersService],
  exports: [UserModulesService, ModuleUsersService],
})
export class UserModulesModule {}

