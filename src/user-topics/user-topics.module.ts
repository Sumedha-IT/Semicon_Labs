import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserTopicsController } from './user-topics.controller';
import { UserTopicsService } from './user-topics.service';
import { UserTopic } from './entities/user-topic.entity';
import { User } from '../users/entities/user.entity';
import { Topic } from '../topics/entities/topic.entity';
import { UserModule } from '../user-modules/entities/user-module.entity';
import { ModuleTopic } from '../module-topics/entities/module-topic.entity';
import { UserModulesModule } from '../user-modules/user-modules.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserTopic,
      User,
      Topic,
      UserModule,
      ModuleTopic,
    ]),
    forwardRef(() => UserModulesModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [UserTopicsController],
  providers: [UserTopicsService],
  exports: [UserTopicsService],
})
export class UserTopicsModule {}

