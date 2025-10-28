import { Entity, Column, ManyToOne, JoinColumn, Index, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Module } from '../../modules/entities/module.entity';
import { Topic } from '../../topics/entities/topic.entity';

@Entity({ name: 'module_topics' })
@Index(['module_id', 'topic_id'], { unique: true }) // Prevent duplicate module-topic pairs
export class ModuleTopic {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: 'created_on', type: 'timestamptz' })
  created_on: Date;

  @UpdateDateColumn({ name: 'updated_on', type: 'timestamptz' })
  updated_on: Date;
  @Column({ name: 'module_id', nullable: false })
  module_id: number;

  @Column({ name: 'topic_id', nullable: false })
  topic_id: number;

  @Column({ name: 'topic_order_in_module', nullable: false })
  topic_order: number;

  @ManyToOne(() => Module, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'module_id' })
  module: Module;

  @ManyToOne(() => Topic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'topic_id' })
  topic: Topic;
}