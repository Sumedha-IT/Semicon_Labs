import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Domain } from '../../domains/entities/domain.entity';
import { Module } from '../../modules/entities/module.entity';

@Entity({ name: 'domain_modules' })
@Index(['domain_id', 'module_id'], { unique: true }) // Prevent duplicate domain-module pairs
export class DomainModule extends BaseEntity {
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

