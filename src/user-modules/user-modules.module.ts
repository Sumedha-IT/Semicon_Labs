import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModulesService } from './user-modules.service';
import { ModuleUsersService } from './module-users.service';
import { ModuleUsersController } from './module-users.controller';
import { UserModule } from './entities/user-module.entity';
import { User } from '../users/entities/user.entity';
import { Module as ModuleEntity } from '../modules/entities/module.entity';
import { UserDomain } from '../user-domains/entities/user-domain.entity';
import { UserTopicsModule } from '../user-topics/user-topics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserModule, User, ModuleEntity, UserDomain]),
    forwardRef(() => UserTopicsModule),
  ],
  controllers: [ModuleUsersController],
  providers: [UserModulesService, ModuleUsersService],
  exports: [UserModulesService, ModuleUsersService],
})
export class UserModulesModule {}
