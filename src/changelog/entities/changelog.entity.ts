import { Entity, Column, ManyToOne, JoinColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'change_log' })
export class ChangeLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'change_type_id' })
  changeTypeId: number;

  @Column({ name: 'change_type', length: 50 })
  changeType: string; // 'domain', 'module', 'topic'

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @UpdateDateColumn({ name: 'updated_on', type: 'timestamptz' })
  updated_on: Date;
}

