import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { UserQuizResponse } from './user-quiz-response.entity';
import { QuizQuestion } from 'src/quiz-ques/quiz-question.entity';
import { QuizQuestionOption } from 'src/quiz-ques-options/quiz-question-options.entity';
import { Quiz } from 'src/quiz/quiz.entity';
import { AttemptQuizDto } from './dtos/attempt-quiz.dto';
import { UserModule } from 'src/user-modules/entities/user-module.entity';
import { User } from 'src/users/entities/user.entity';


@Injectable()
export class QuizAttemptService {
  constructor(
    @InjectRepository(UserQuizResponse)
    private readonly responseRepo: Repository<UserQuizResponse>,
    @InjectRepository(Quiz)
    private readonly quizRepo: Repository<Quiz>,
    @InjectRepository(QuizQuestion)
    private readonly questionRepo: Repository<QuizQuestion>,
    @InjectRepository(QuizQuestionOption)
    private readonly optionRepo: Repository<QuizQuestionOption>,
    @InjectRepository(UserModule)
    private readonly userModuleRepo: Repository<UserModule>,
  ) {}

  // async attemptQuiz(dto: AttemptQuizDto) {
  //   const quiz = await this.quizRepo.findOne({
  //     where: { id: dto.quiz_id },
  //     relations: ['questions'],
  //   });
  //   if (!quiz) throw new NotFoundException('Quiz not found');

  //   const questionIds = dto.answers.map((a) => a.question_id);
  //   const questions = await this.questionRepo.find({
  //     where: { id: In(questionIds) },
  //     relations: ['options'],
  //   });

  //   const allOptions = await this.optionRepo.find({
  //     where: { id: In(dto.answers.map((a) => a.selected_option_id)) },
  //   });

  //   let totalMarks = 0;
  //   let correctCount = 0;

  //   const responses: UserQuizResponse[] = [];

  //   for (const ans of dto.answers) {
  //     const question = questions.find((q) => q.id === ans.question_id);
  //     const selectedOption = allOptions.find(
  //       (opt) => opt.id === ans.selected_option_id,
  //     );

  //     if (!question || !selectedOption) continue;

  //     const isCorrect = !!selectedOption.is_correct;
  //     const marksObtained = isCorrect ? (question.marks || 0) : 0;

  //     if (isCorrect) {
  //       totalMarks += marksObtained;
  //       correctCount++;
  //     }

  //     const response = this.responseRepo.create({
  //       user_id: dto.user_id,
  //       quiz,
  //       question,
  //       option: selectedOption,
  //       is_correct: isCorrect,
  //       marks_obtained: marksObtained,
  //     });
  //     responses.push(response);
  //   }

  //   await this.responseRepo.save(responses);

  //   return {
  //     quiz_id: quiz.id,
  //     user_id: dto.user_id,
  //     total_questions: quiz.questions.length,
  //     attempted: dto.answers.length,
  //     correct: correctCount,
  //     total_marks: totalMarks,
  //   };
  // }

  async attemptQuiz(dto: AttemptQuizDto) {
  const quiz = await this.quizRepo.findOne({
    where: { id: dto.quiz_id },
    relations: ['questions', 'module'],
  });
  if (!quiz) throw new NotFoundException('Quiz not found');

  const questionIds = dto.answers.map((a) => a.question_id);
  const questions = await this.questionRepo.find({
    where: { id: In(questionIds) },
    relations: ['options'],
  });

  const allOptions = await this.optionRepo.find({
    where: { id: In(dto.answers.map((a) => a.selected_option_id)) },
  });

  let totalMarks = 0;
  let correctCount = 0;

  const responses: UserQuizResponse[] = [];

  for (const ans of dto.answers) {
    const question = questions.find((q) => q.id === ans.question_id);
    const selectedOption = allOptions.find(
      (opt) => opt.id === ans.selected_option_id,
    );

    if (!question || !selectedOption) continue;

    const isCorrect = !!selectedOption.is_correct;
    const marksObtained = isCorrect ? (question.marks || 0) : 0;

    if (isCorrect) {
      totalMarks += marksObtained;
      correctCount++;
    }

    const response = this.responseRepo.create({
      user_id: dto.user_id,
      quiz,
      question,
      option: selectedOption,
      is_correct: isCorrect,
      marks_obtained: marksObtained,
    });
    responses.push(response);
  }

  await this.responseRepo.save(responses);

  // Calculate score percentage
  const maxMarks =
    quiz.questions.reduce((sum, q) => sum + (q.marks || 0), 0) || 1;
  const percentage = (totalMarks / maxMarks) * 100;
  // console.log("quiz", quiz)

  // Find or create user_module record
  let userModule = await this.userModuleRepo.findOne({
    where: { user_id: dto.user_id, module_id: quiz.module.id },
  });

  const status =
    percentage >= 70
      ? 'passed'
      : percentage >= 40
      ? 'inProgress'
      : 'failed';

  if (!userModule) {
    throw new NotFoundException(`User not enrolled into this module id ${quiz.module.id}`);
    // userModule = this.userModuleRepo.create({
    //   user_id: dto.user_id,
    //   module_id: quiz.module,
    //   questions_answered: dto.answers.length,
    //   score: percentage,
    //   status,
    //   completed_on: new Date(),
    // });
  } else {
    userModule.questions_answered = dto.answers.length;
    userModule.score = percentage;
    userModule.status = status;
    userModule.completed_on = new Date();
  }

  await this.userModuleRepo.save(userModule);

  return {
    quiz_id: quiz.id,
    user_id: dto.user_id,
    total_questions: quiz.questions.length,
    attempted: dto.answers.length,
    correct: correctCount,
    total_marks: totalMarks,
    score_percentage: percentage.toFixed(2),
    status,
  };
}

async getQuizResult(user_id: number, quiz_id: number) {

  const quiz = await this.quizRepo.findOne({
    where: { id: quiz_id },
    relations: ['questions', 'module'],
  });
  if (!quiz) throw new NotFoundException('Quiz not found');

  const result = await this.userModuleRepo.findOne({
    where: { user_id, module_id: quiz.module.id},
  });

  if (!result)
    throw new NotFoundException('No quiz result found for this user');

  return {
    user_id: result.user_id,
    quiz_id: result.module_id,
    questions_answered: result.questions_answered,
    score: result.score,
    status: result.status,
    completed_on: result.completed_on,
  };
}



}
