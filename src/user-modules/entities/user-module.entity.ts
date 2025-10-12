import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Module } from '../../modules/entities/module.entity';

@Entity({ name: 'user_modules' })
@Index(['user_id', 'module_id'], { unique: true })
export class UserModule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  user_id: number;

  @Column({ type: 'int' })
  module_id: number;

  @Column({ type: 'int', default: 0 })
  questions_answered: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  score: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 70 })
  threshold_score: number;

  @Column({ type: 'varchar', length: 20, default: 'not_started' })
  status: string; // 'not_started' | 'in_progress' | 'completed' | 'passed' | 'failed'

  @CreateDateColumn({ name: 'joined_on', type: 'timestamptz' })
  joined_on: Date;

  @Column({ name: 'completed_on', type: 'timestamptz', nullable: true })
  completed_on: Date | null;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Module, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'module_id' })
  module: Module;
}

