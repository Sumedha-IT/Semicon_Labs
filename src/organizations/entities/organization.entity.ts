import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity({ name: 'organizations' })
export class Organization {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: 'created_on', type: 'timestamptz' })
  created_on: Date;

  @UpdateDateColumn({ name: 'updated_on', type: 'timestamptz' })
  updated_on: Date;

  @DeleteDateColumn({ name: 'deleted_on', type: 'timestamptz' })
  deleted_on: Date | null;
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

  // Note: Removed @OneToMany relation to prevent loading all users
  // Use separate endpoint /organizations/:id/users to get user details
  // Use getUserCount() method to get user count only
}
