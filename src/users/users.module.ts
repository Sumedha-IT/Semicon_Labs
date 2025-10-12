import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersV1Controller } from './users-v1.controller';
import { User } from './entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { UserDomainsModule } from '../user-domains/user-domains.module';
import { UserModulesModule } from '../user-modules/user-modules.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Organization]), UserDomainsModule, UserModulesModule],
  controllers: [UsersController, UsersV1Controller],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}