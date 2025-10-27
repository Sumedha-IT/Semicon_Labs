import { BaseEntity } from 'src/common/entities/base.entity';
import { UserTool } from 'src/user-tool/user-tool.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';

@Entity({ name: 'tools' })
export class Tool extends BaseEntity {
  @Index({ unique: true })

  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @OneToMany(() => UserTool, (ut) => ut.tool)
  userTools: UserTool[];
}
