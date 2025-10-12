import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';

@Entity({ name: 'organizations' })
export class Organization {
  @PrimaryGeneratedColumn()
  org_id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 50, nullable: true })
  type?: string; // semicon, corporate, startup, university, government, other

  @Column({ length: 100, nullable: true })
  industry?: string; // IT, Telecom, Healthcare, Finance, Education, Manufacturing, etc.

  @Column({ length: 150, nullable: true })
  location?: string;

  @Column({ length: 100, nullable: true })
  poc_name?: string;

  @Column({ length: 20, nullable: true })
  poc_phone?: string;

  @Column({ length: 100, nullable: true })
  poc_email?: string;

  @Column({ nullable: true })
  subscription_id?: number; // Reference to subscription plan

  @CreateDateColumn({ name: 'created_on' })
  created_on: Date;

  @CreateDateColumn({ name: 'updated_on' })
  updated_on: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'deleted_on' })
  deleted_on: Date;

  // Note: Removed @OneToMany relation to prevent loading all users
  // Use separate endpoint /organizations/:id/users to get user details
  // Use getUserCount() method to get user count only
}