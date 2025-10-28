import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserDomain } from './entities/user-domain.entity';
import { Domain } from '../domains/entities/domain.entity';
import { User } from '../users/entities/user.entity';
import { UserModule } from '../user-modules/entities/user-module.entity';
import { UserDomainsService } from './user-domains.service';
import { UserDomainsController } from './user-domains.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserDomain, Domain, User, UserModule])],
  controllers: [UserDomainsController],
  providers: [UserDomainsService],
  exports: [UserDomainsService],
})
export class UserDomainsModule {}
