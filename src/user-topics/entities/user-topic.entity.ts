import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Topic } from '../../topics/entities/topic.entity';
import { UserModule } from '../../user-modules/entities/user-module.entity';

@Entity({ name: 'user_topics' })
@Index(['user_module_id', 'topic_id'], { unique: true })
export class UserTopic extends BaseEntity {
  @Column({ type: 'int' })
  topic_id: number;

  @Column({ type: 'int' })
  user_module_id: number;

  @Column({ type: 'varchar', length: 20, default: 'todo' })
  status: string; // 'todo' | 'inProgress' | 'completed'

  @ManyToOne(() => Topic, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'topic_id' })
  topic: Topic;

  @ManyToOne(() => UserModule, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_module_id' })
  userModule: UserModule;
}

