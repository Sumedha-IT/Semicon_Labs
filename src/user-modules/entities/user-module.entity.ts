import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ProgressBaseEntity } from '../../common/entities/progress-base.entity';
import { UserDomain } from '../../user-domains/entities/user-domain.entity';
import { Module } from '../../modules/entities/module.entity';

@Entity({ name: 'user_modules' })
@Index(['user_domain_id', 'module_id'], { unique: true })
export class UserModule extends ProgressBaseEntity {
  @Column({ type: 'int' })
  user_domain_id: number;

  @Column({ type: 'int' })
  module_id: number;

  @Column({ type: 'int', default: 0 })
  questions_answered: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  score: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 70 })
  threshold_score: number;

  @Column({ type: 'varchar', length: 20, default: 'todo' })
  status: string; // 'todo' | 'inProgress' | 'completed' | 'passed' | 'failed'

  @Column({ name: 'completed_on', type: 'timestamptz', nullable: true })
  completed_on: Date | null;

  @ManyToOne(() => UserDomain, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_domain_id' })
  userDomain: UserDomain;

  @ManyToOne(() => Module, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'module_id' })
  module: Module;
}
