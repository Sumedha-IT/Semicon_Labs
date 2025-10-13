import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { Organization } from './entities/organization.entity';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { UserDomainsModule } from '../user-domains/user-domains.module';
import { UserModulesModule } from '../user-modules/user-modules.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, User]),
    UserDomainsModule,
    UserModulesModule,
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, UsersService],
  exports: [OrganizationsService, UsersService],
})
export class OrganizationsModule {}
