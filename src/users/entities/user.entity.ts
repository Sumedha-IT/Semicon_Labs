import { Entity, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, DeleteDateColumn } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: 'joined_on', type: 'timestamptz' })
  joined_on: Date;

  @UpdateDateColumn({ name: 'updated_on', type: 'timestamptz' })
  updated_on: Date;

  @DeleteDateColumn({ name: 'deleted_on', type: 'timestamptz' })
  deleted_on: Date | null;

  @Column({ length: 100, nullable: true })
  name: string;

  @Column({ length: 100, unique: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  password_hash: string;

  @Column({ length: 50, nullable: true })
  role: string; // PlatformAdmin, ClientAdmin, Manager, Learner

  @Column({ type: 'date', nullable: true })
  dob: Date;

  @Column({ length: 20, nullable: true })
  user_phone: string;

  @Column({ length: 150, nullable: true })
  location: string;

  @Column({ length: 100, nullable: true })
  registered_device_no: string;

  @Column({ nullable: true })
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

  // Removed is_verified and email_verified_at - verification tracked in Redis only

  @Column({ default: 0 })
  failed_otp_attempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  account_locked_until: Date | null;

  @Column({ length: 100, nullable: true })
  profession: string;

  @Column({ length: 100, nullable: true })
  highest_qualification: string;

  @Column({ length: 150, nullable: true })
  highest_qualification_specialization: string;
}


