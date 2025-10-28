import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersV1Controller } from './users-v1.controller';
import { User } from './entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { UserDomain } from '../user-domains/entities/user-domain.entity';
import { UserModule } from '../user-modules/entities/user-module.entity';
import { UserDomainsModule } from '../user-domains/user-domains.module';
import { UserTopicsModule } from '../user-topics/user-topics.module';
import { ModulesModule } from '../modules/modules.module';
import { OtpModule } from '../otp/otp.module';
import { MailModule } from '../mail/mail.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Organization, UserDomain, UserModule]),
    UserDomainsModule,
    forwardRef(() => UserTopicsModule),
    forwardRef(() => ModulesModule),
    OtpModule,
    MailModule,
    RedisModule,
  ],
  controllers: [UsersController, UsersV1Controller],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
