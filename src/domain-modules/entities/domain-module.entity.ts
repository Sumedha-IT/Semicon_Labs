import { Entity, Column, ManyToOne, JoinColumn, Index, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Domain } from '../../domains/entities/domain.entity';
import { Module } from '../../modules/entities/module.entity';

@Entity({ name: 'domain_modules' })
@Index(['domain_id', 'module_id'], { unique: true }) // Prevent duplicate domain-module pairs
export class DomainModule {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: 'created_on', type: 'timestamptz' })
  created_on: Date;

  @UpdateDateColumn({ name: 'updated_on', type: 'timestamptz' })
  updated_on: Date;
  @Column({ name: 'domain_id', nullable: false })
  domain_id: number;

  @Column({ name: 'module_id', nullable: false })
  module_id: number;

  @ManyToOne(() => Domain, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'domain_id' })
  domain: Domain;

  @ManyToOne(() => Module, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'module_id' })
  module: Module;
}

