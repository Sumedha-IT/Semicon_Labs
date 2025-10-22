import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Topic } from '../../topics/entities/topic.entity';

@Entity({ name: 'user_topics' })
@Index(['user_id', 'topic_id'], { unique: true })
export class UserTopic extends BaseEntity {
  @Column({ type: 'int' })
  user_id: number;

  @Column({ type: 'int' })
  topic_id: number;

  @Column({ type: 'varchar', length: 20, default: 'todo' })
  status: string; // 'todo' | 'inProgress' | 'completed'

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Topic, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'topic_id' })
  topic: Topic;
}

