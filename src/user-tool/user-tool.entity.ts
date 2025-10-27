import { BaseEntity } from 'src/common/entities/base.entity';
import { Tool } from 'src/tool/tool.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Column,
} from 'typeorm';
// import { Tool } from './tool.entity';

@Entity({ name: 'user_tools' })
@Unique(['tool', 'user_domain_id'])
export class UserTool extends BaseEntity {

  @ManyToOne(() => Tool, (tool) => tool.userTools, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tool_id' })
  tool: Tool;

  @Column()
  user_domain_id: number;
}
