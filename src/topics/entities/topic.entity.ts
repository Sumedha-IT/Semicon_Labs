import { Entity, Column, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { ModuleTopic } from '../../module_topics/entities/module-topic.entity';

@Entity({ name: 'topics' })
export class Topic extends BaseEntity {
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