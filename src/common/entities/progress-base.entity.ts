import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

/**
 * Base entity for progress-tracking tables
 * Uses joined_on instead of created_on to indicate when user joined/enrolled
 * Includes updated_on to track when progress is updated
 */
export abstract class ProgressBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: 'joined_on', type: 'timestamptz' })
  joined_on: Date;

  @UpdateDateColumn({ name: 'updated_on', type: 'timestamptz' })
  updated_on: Date;

  @DeleteDateColumn({ name: 'deleted_on', type: 'timestamptz' })
  deleted_on: Date | null;
}

