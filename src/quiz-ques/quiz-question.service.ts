/*
https://docs.nestjs.com/providers#services
*/

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuizQuestion } from './quiz-question.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ChangelogService } from 'src/changelog/changelog.service';
import { In, Repository } from 'typeorm';
import {
  AssignQuestionsDto,
  CreateQuizQuestionDto,
} from './dtos/create-quiz-ques.dto';
import { Quiz } from 'src/quiz/quiz.entity';
import { UpdateQuizQuestionDto } from './dtos/update-ques.dto';
import { QuizquestionOptionsService } from 'src/quiz-ques-options/quiz-question-options.service';
import { QuizQuestionOption } from 'src/quiz-ques-options/quiz-question-options.entity';

@Injectable()
export class QuizQuestionService {
  constructor(
    @InjectRepository(QuizQuestion)
    private readonly quizQuesRepo: Repository<QuizQuestion>,
    private readonly changelogService: ChangelogService,
    @InjectRepository(QuizQuestionOption)
    private readonly optionRepo: Repository<QuizQuestionOption>,
    @InjectRepository(Quiz)
    private readonly quizRepo: Repository<Quiz>,
  ) {}

  async validateUniqueQues(question: string) {
    const existingTitle = await this.quizQuesRepo.findOne({
      where: { question },
    });

    if (existingTitle) {
      throw new ConflictException(
        `Quiz with title "${question}" already exists`,
      );
    }
  }

  async create(dto: CreateQuizQuestionDto) {
    // await this.validateUniqueQues(dto.question);
    const question = this.quizQuesRepo.create(dto);
    const saveQues = await this.quizQuesRepo.save(question);
    const result = await this.quizQuesRepo.findOne({
      where: { id: saveQues.id },
      select: {
        id: true,
        question: true,
        marks: true,
        order_in_quiz: true,
      },
    });

    if (!result) {
      throw new NotFoundException('quiz creation failed');
    }

    return result;
  }

  async assignQuestions(dto: AssignQuestionsDto) {
    const quiz = await this.quizRepo.findOne({ where: { id: dto.quiz_id } });
    // console.log('Received body:', dto, quiz);
    if (!quiz) throw new NotFoundException('Quiz not found');

    const questions = await this.quizQuesRepo.find({
      where: { id: In(dto.question_ids) },
    });

    //  Check if any question already assigned to a quiz
    const alreadyAssigned = questions.filter(
      (q) => q.quiz && q.quiz.id !== quiz.id,
    );
    if (alreadyAssigned.length > 0) {
      const ids = alreadyAssigned.map((q) => q.id);
      throw new BadRequestException(
        `Questions [${ids.join(', ')}] are already assigned to another quiz`,
      );
    }

    if (questions.length === 0)
      throw new NotFoundException('No questions found for provided IDs');

    const existingQuestionCount = await this.quizQuesRepo.count({
      where: { quiz: { id: quiz.id } },
    });

    const totalAfterAssignment = existingQuestionCount + questions.length;
    if (totalAfterAssignment > quiz.no_of_questions) {
      throw new BadRequestException(
        `You can't have more than ${quiz.no_of_questions} questions in this quiz`,
      );
    }

    for (const q of questions) {
      q.quiz = quiz;
    }

    await this.quizQuesRepo.save(questions);
    return { message: 'Questions assigned successfully', quiz_id: quiz.id };
  }

  async findQuestionsByQuiz(quizId: number) {
    return this.quizQuesRepo.find({
      where: { quiz: { id: quizId } },
      relations: ['options'],
    });
  }
 
  async updateQuestion(id: number, update_dto: UpdateQuizQuestionDto, userId: number) {
    const question = await this.quizQuesRepo.findOne({ where: { id } });
    if (!question) throw new NotFoundException('Question not found');
    const { reason, ...dto } = update_dto;
    Object.assign(question, dto);

     // Create changelog entry
    await this.changelogService.createLog({
      changeType: 'quiz-question',
      changeTypeId: id,
      userId: userId,
      reason,
    });

    return this.quizQuesRepo.save(question);
  } 

  // async deleteQuestion(id: number) {
  //   const question = await this.quizQuesRepo.findOne({ where: { id } });
  //   if (!question) throw new NotFoundException('Question not found');

  //   await this.quizQuesRepo.remove(question);
  //   return { message: 'Question deleted successfully', id };
  // }

  // Unassign (unlink) given option IDs (or all) from a question
  async unassignOptionsFromQuestion(questionId: number, userId: number, reason: string, optionIds?: number[]) {
    const question = await this.quizQuesRepo.findOne({
      where: { id: questionId },
      relations: ['options'],
    });
    if (!question) throw new NotFoundException('Question not found');

    if (!question.options || !question.options.length) {
      return { message: 'No options assigned to this question', questionId };
    }

    if (!optionIds || optionIds.length === 0) {
      // remove all associations
      question.options = [];
    } else {
      // filter out the options to be unassigned
      question.options = question.options.filter(
        (opt) => !optionIds.includes(opt.id),
      );
    }

    await this.quizQuesRepo.save(question);
     // Create changelog entry
    await this.changelogService.createLog({
      changeType: 'quiz-question',
      changeTypeId: questionId,
      userId: userId,
      reason,
    });
    return { message: 'Options unassigned successfully', questionId };
  }

  // Safe delete: first unlink all options (so join-table rows removed), then remove question
  async deleteQuestion(id: number, userId: number, reason: string) {
    const question = await this.quizQuesRepo.findOne({
      where: { id },
      relations: {
        options: true,
        quiz: true,
      },
    });
    
    if (!question) throw new NotFoundException('Question not found');
    console.log('question options', question);
    if (question.options && question.options.length > 0) {
      await this.optionRepo.remove(question.options);
    }

    // Unassign question from quiz if exists
    if (question.quiz) {
      question.quiz = null;
      await this.quizQuesRepo.save(question);
    }
    await this.quizQuesRepo.remove(question);
    await this.changelogService.createLog({
      changeType: 'quiz-question-option',
      changeTypeId: id,
      userId: userId,
      reason,
    });

    return { message: 'Question deleted and associations removed', id };
  }

  async getQuestionById(id: number) {
    const question = await this.quizQuesRepo.findOne({
      where: { id },
      relations: {
        options: true,
        quiz: true,
      },
    });

    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }

    return {
      message: 'Question fetched successfully',
      data: question,
    };
  }
}
