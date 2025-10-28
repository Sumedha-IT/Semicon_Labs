import { Entity, Column, Index, OneToMany, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ModuleTopic } from '../../module-topics/entities/module-topic.entity';

@Entity({ name: 'topics' })
export class Topic {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: 'created_on', type: 'timestamptz' })
  created_on: Date;

  @UpdateDateColumn({ name: 'updated_on', type: 'timestamptz' })
  updated_on: Date;
  @Index({ unique: true })
  @Column({ length: 200 })
  title: string;

  @Column({ name: 'desc', type: 'text', nullable: true })
  desc?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  level?: string | null;

  // Many-to-many relationship with modules through module_topics join table
  @OneToMany(() => ModuleTopic, (moduleTopic) => moduleTopic.topic)
  moduleTopics: ModuleTopic[];
}