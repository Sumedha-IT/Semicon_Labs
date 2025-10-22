import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { typeOrmConfig } from './config/database.config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { DomainsModule } from './domains/domains.module';
import { ModulesModule } from './modules/modules.module';
import { DomainModulesModule } from './domain-modules/domain-modules.module';
import { UserModulesModule } from './user-modules/user-modules.module';
import { TopicsModule } from './topics/topics.module';
import { ModuleTopicsModule } from './module_topics/module-topics.module';
import { UserTopicsModule } from './user-topics/user-topics.module';
import { ChangelogModule } from './changelog/changelog.module';
import { DocContentsModule } from './doc-contents/doc-contents.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) =>
        typeOrmConfig(configService),
      inject: [ConfigService],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'temp-uploads'),
      serveRoot: '/temp-uploads',
      serveStaticOptions: {
        index: false,
      },
    }),
    AuthModule,
    UsersModule,
    OrganizationsModule,
    DomainsModule,
    ModulesModule,
    DomainModulesModule,
    UserModulesModule,
    TopicsModule,
    ModuleTopicsModule,
    UserTopicsModule,
    ChangelogModule,
    DocContentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
