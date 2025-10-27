/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tool } from './tool.entity';
import { ToolController } from './tool.controller';
import { ToolService } from './tool.service';
import { UserTool } from 'src/user-tool/user-tool.entity';
import { UserDomain } from 'src/user-domains/entities/user-domain.entity';
import { ChangelogModule } from 'src/changelog/changelog.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Tool, UserTool, UserDomain]),
        ToolModule,
        ChangelogModule,
    ],
    controllers: [ToolController],
    providers: [ToolService],
    exports: [ToolService]
})
export class ToolModule {}
