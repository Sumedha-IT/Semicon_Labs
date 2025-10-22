import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const typeOrmConfig = (cs: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: cs.get<string>('DB_HOST', 'localhost'),
  port: cs.get<number>('DB_PORT', 5434),
  username: cs.get<string>('DB_USER', 'postgres'),
  password: cs.get<string>('DB_PASSWORD'), // Required in .env file
  database: cs.get<string>('DB_NAME', 'semiconlabs'),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false, // Disabled - schema is correct, don't let TypeORM modify it
  logging: true, // Only for development
  retryAttempts: 3,
  retryDelay: 3000,
  autoLoadEntities: true,
});
