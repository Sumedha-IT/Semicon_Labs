import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'modules' })
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

  // Many-to-many relationship with domains handled through domain_modules join table
}
