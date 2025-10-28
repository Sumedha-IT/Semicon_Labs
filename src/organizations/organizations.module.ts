import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { Organization } from './entities/organization.entity';
import { User } from '../users/entities/user.entity';
import { UserDomain } from '../user-domains/entities/user-domain.entity';
import { UserModule } from '../user-modules/entities/user-module.entity';
import { UsersModule } from '../users/users.module';
import { UserDomainsModule } from '../user-domains/user-domains.module';
import { UserModulesModule } from '../user-modules/user-modules.module';
import { UserTopicsModule } from '../user-topics/user-topics.module';
import { OtpModule } from '../otp/otp.module';
import { MailModule } from '../mail/mail.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, User, UserDomain, UserModule]),
    UserDomainsModule,
    UserModulesModule,
    forwardRef(() => UserTopicsModule),
    OtpModule,
    MailModule,
    RedisModule,
    UsersModule,
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
