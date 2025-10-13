import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserDomain } from './entities/user-domain.entity';
import { Domain } from '../domains/entities/domain.entity';
import { User } from '../users/entities/user.entity';
import { UserDomainsService } from './user-domains.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserDomain, Domain, User])],
  providers: [UserDomainsService],
  exports: [UserDomainsService],
})
export class UserDomainsModule {}
