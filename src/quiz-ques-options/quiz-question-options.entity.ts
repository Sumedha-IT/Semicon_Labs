import { QuizQuestion } from 'src/quiz-ques/quiz-question.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  ManyToMany,
} from 'typeorm';


@Entity({ name: 'quiz_question_option' })
export class QuizQuestionOption {
  @PrimaryGeneratedColumn()
  id: number;
  
  // @ManyToMany(() => QuizQuestion, (question) => question.options)
  // @JoinColumn({name:'quiz_ques_id'})
  // question: QuizQuestion[];

  @ManyToOne(() => QuizQuestion, (question) => question.options, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quiz_ques_id' })
  question: QuizQuestion | null;

  @Column({ type: 'text' })
  option_text: string;

  @Column({ default: false })
  is_correct: boolean;
}
