import { Entity, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: 'joined_on', type: 'timestamptz' })
  joined_on: Date;

  @UpdateDateColumn({ name: 'updated_on', type: 'timestamptz' })
  updated_on: Date;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 100, unique: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  password_hash: string;

  @Column({ length: 50, nullable: false })
  role: string; // PlatformAdmin, ClientAdmin, Manager, Learner

  @Column({ type: 'date', nullable: true })
  dob: Date;

  @Column({ length: 20, nullable: false })
  user_phone: string;

  @Column({ length: 150, nullable: false })
  location: string;

  @Column({ length: 100, nullable: false })
  registered_device_no: string;

  @Column({ nullable: false })
  tool_id: number;

  @Column({ nullable: true })
  org_id: number;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column({ type: 'int', nullable: true })
  manager_id: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'manager_id' })
  manager: User;

  @Column({ type: 'timestamptz', nullable: true })
  deleted_on: Date;
}
