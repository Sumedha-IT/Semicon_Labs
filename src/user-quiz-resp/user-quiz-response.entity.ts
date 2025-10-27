import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { QuizQuestionOption } from 'src/quiz-ques-options/quiz-question-options.entity';
import { QuizQuestion } from 'src/quiz-ques/quiz-question.entity';
import { Quiz } from 'src/quiz/quiz.entity';

@Entity()
export class UserQuizResponse {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @ManyToOne(() => Quiz, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quiz_id' })
  quiz: Quiz;

  @ManyToOne(() => QuizQuestion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quiz_question_id' })
  question: QuizQuestion;

  @ManyToOne(() => QuizQuestionOption, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'quiz_option_id' })
  option: QuizQuestionOption;

  @Column({ nullable: true })
  is_correct?: boolean;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  marks_obtained?: number;
}

