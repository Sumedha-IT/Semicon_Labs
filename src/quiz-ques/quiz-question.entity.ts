import { QuizQuestionOption } from 'src/quiz-ques-options/quiz-question-options.entity';
import { Quiz } from '../quiz/quiz.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  JoinTable,
  ManyToMany,
} from 'typeorm';

@Entity({ name: 'quiz_question' })
export class QuizQuestion {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Quiz, (quiz) => quiz.questions, { onDelete: 'CASCADE', nullable: true, })
  @JoinColumn({ name: 'quiz_id' })
  quiz?: Quiz | null;

  @Column({ type: 'text' })
  question: string;

  @Column({ nullable: true })
  image_url?: string;

  @Column({ nullable: true })
  question_type?: string;

  @Column({ nullable: true })
  order_in_quiz?: number;

  @Column({ type: 'int', nullable: true })
  marks?: number;
  // @ManyToMany(() => QuizQuestionOption, (option) => option.question, {
  //   cascade: true,
  // })
  // @JoinTable({
  //   name: 'question_options_mapping', // join table name
  //   joinColumn: { name: 'quiz_ques_id', referencedColumnName: 'id' },
  //   inverseJoinColumn: { name: 'option_id', referencedColumnName: 'id' },
  // })
  // options: QuizQuestionOption[];
  @OneToMany(() => QuizQuestionOption, (option) => option.question, {
    cascade: true,
  })
  options: QuizQuestionOption[];
}

