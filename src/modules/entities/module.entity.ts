import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Domain } from '../../domains/entities/domain.entity';

@Entity({ name: 'modules' })
@Index(['title', 'domainId'], { unique: true }) // Composite unique index: same title allowed in different domains
export class Module {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ length: 200, nullable: false })
  title: string;

  @Column({ type: 'text', array: true, nullable: false })
  skills: string[];

  @Column({ name: 'desc', type: 'text', nullable: false })
  desc: string;

  @Column({ type: 'int', nullable: false })
  duration: number; // Duration in minutes

  @Column({ length: 50, nullable: false })
  level: string; // Beginner, Intermediate, Advanced

  @CreateDateColumn({ name: 'created_on', type: 'timestamptz' })
  created_on: Date;

  @UpdateDateColumn({ name: 'updated_on', type: 'timestamptz' })
  updated_on: Date;

  @Column({ name: 'domain_id', nullable: false })
  domainId: number;

  @ManyToOne(() => Domain, { nullable: false, onDelete: 'CASCADE' })//if domain is deleted, all modules related to it will be deleted
  @JoinColumn({ name: 'domain_id' })
  domain: Domain;
}
