import { Entity, Column, Index, OneToMany, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { DomainModule } from '../../domain-modules/entities/domain-module.entity';

@Entity({ name: 'domains' })
export class Domain {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: 'created_on', type: 'timestamptz' })
  created_on: Date;

  @UpdateDateColumn({ name: 'updated_on', type: 'timestamptz' })
  updated_on: Date;
  @Index({ unique: true })
  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @OneToMany(() => DomainModule, (dm: DomainModule) => dm.domain)
  domainModules: DomainModule[];
}
