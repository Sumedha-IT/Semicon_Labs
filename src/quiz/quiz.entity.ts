import { Entity, Column, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { ModuleTopic } from '../module_topics/entities/module-topic.entity';

@Entity({ name: 'quiz' })
export class Quiz extends BaseEntity {
  @Index({ unique: true })

  @Column()
  quiz_type_id: string;

  @Column()
  quiz_type: string;
  require: true;

  @Column()
  title: string;

  @Column({ type: 'varchar', nullable: true })
  file_url?: string;

  @Column({nullable: true})
  duration?: Number;

  @Column()
  total_marks: Number;

  @Column({ name: 'desc', type: 'text', nullable: true })
  desc?: string | null;

  @Column()
  is_Mandatory: Boolean;

  @Column()
  no_of_questions: Number;
}