import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Domain } from '../../domains/entities/domain.entity';
import { Module } from './module.entity';

@Entity({ name: 'domain_modules' })
@Index(['domain_id', 'module_id'], { unique: true }) // Prevent duplicate domain-module pairs
export class DomainModule {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'domain_id', nullable: false })
  domain_id: number;

  @Column({ name: 'module_id', nullable: false })
  module_id: number;

  @CreateDateColumn({ name: 'created_on', type: 'timestamptz' })
  created_on: Date;

  @ManyToOne(() => Domain, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'domain_id' })
  domain: Domain;

  @ManyToOne(() => Module, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'module_id' })
  module: Module;
}
