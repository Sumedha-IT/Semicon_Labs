import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

/**
 * Base entity class with common fields for all entities.
 * All entities should extend this class to inherit common metadata fields.
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: 'created_on', type: 'timestamptz' })
  created_on: Date;

  @UpdateDateColumn({ name: 'updated_on', type: 'timestamptz' })
  updated_on: Date;

  @DeleteDateColumn({ name: 'deleted_on', type: 'timestamptz' })
  deleted_on: Date | null;
}

