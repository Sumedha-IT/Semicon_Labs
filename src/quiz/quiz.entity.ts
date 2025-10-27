import { Entity, Column, Index, OneToMany, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { ModuleTopic } from '../module_topics/entities/module-topic.entity';
import { QuizQuestion } from 'src/quiz-ques/quiz-question.entity';
import { Module as ModuleEntity } from 'src/modules/entities/module.entity';

@Entity({ name: 'quiz' })
export class Quiz extends BaseEntity {
  @Index({ unique: true })

  // @Column()
  // quiz_type_id: string;
  // // its a module id

  // @Column()
  // quiz_type: string;
  // require: true;

  @Column()
  title: string;

  @Column({ type: 'varchar', nullable: true })
  file_url?: string;

  @Column({nullable: true})
  duration?: number;

  @Column()
  total_marks: number;

  @Column({ name: 'desc', type: 'text', nullable: true })
  desc?: string | null;

  @Column()
  is_Mandatory: Boolean;

  @Column()
  no_of_questions: number;

  @OneToOne(() => ModuleEntity, module => module.quiz, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'module_id' })
  module: ModuleEntity;

  @OneToMany(() => QuizQuestion, (question) => question.quiz, { cascade: true })
  questions: QuizQuestion[];
}