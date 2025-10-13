import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn({ name: 'user_id' })
  user_id: number;

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

  @CreateDateColumn()
  joined_on: Date;

  @CreateDateColumn()
  updated_on: Date;

  @Column({ type: 'timestamp', nullable: true })
  deleted_on: Date;
}
