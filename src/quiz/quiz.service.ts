import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Quiz } from './quiz.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, ILike, Repository } from 'typeorm';
import { ChangelogService } from 'src/changelog/changelog.service';
import { CreateQuizDto } from './dtos/quiz.dto';
import { AssignQuestionsDto, UpdateQuizDto } from './dtos/update-quiz.dto';
import { QuizQuestion } from 'src/quiz-ques/quiz-question.entity';
import { Module as ModuleEntity } from '../modules/entities/module.entity';

@Injectable()
export class QuizService {
  constructor(
    @InjectRepository(Quiz)
    private readonly quizRepo: Repository<Quiz>,
    @InjectRepository(QuizQuestion)
    private readonly questionRepo: Repository<QuizQuestion>,
    private readonly changelogService: ChangelogService,
     @InjectRepository(ModuleEntity)
        private readonly moduleRepo: Repository<ModuleEntity>,
  ) {}

  async validateUniqueTitle(title: string) {
    const existingTitle = await this.quizRepo.findOne({ where: { title } });

    if (existingTitle) {
      throw new ConflictException(`Quiz with title "${title}" already exists`);
    }
  }

  async create(dto: CreateQuizDto) {
    await this.validateUniqueTitle(dto.title);
    const quiz = this.quizRepo.create(dto);
    const saveQuiz = await this.quizRepo.save(quiz);
    if(dto.module_id){
      const module = await this.moduleRepo.findOne({ where: { id: dto.module_id }, relations: ['quiz'] });
  if (!module) throw new NotFoundException('Module not found');

  if (module.quiz) {
    throw new BadRequestException('This module already has a quiz assigned');
  }

  quiz.module = module;
  // quiz.module_id = module.id;
  return this.quizRepo.save(quiz);
    }
    const result = await this.quizRepo.findOne({
      where: { id: saveQuiz.id },
      select: {
        id: true,
        title: true,
        no_of_questions: true,
        desc: true,
        total_marks: true,
        module: true,
      },
    });

    if (!result) {
      throw new NotFoundException('quiz creation failed');
    }

    return result;
  }

  // async assignQuestions(dto: AssignQuestionsDto) {
  //   const quiz = await this.quizRepo.findOne({
  //     where: { id: dto.quiz_id },
  //     relations: ['questions'],
  //   });
  //   if (!quiz) throw new NotFoundException('Quiz not found');

  //   const questions = await this.questionRepo.findByIds(dto.question_ids);
  //   if (!questions.length)
  //     throw new NotFoundException('No valid questions found');

  //   // ✅ Link questions to quiz
  //   for (const question of questions) {
  //     question.quiz = quiz;
  //   }

  //   await this.questionRepo.save(questions);

  //   return {
  //     message: `Assigned ${questions.length} questions to quiz ${quiz.id}`,
  //     assignedQuestionIds: questions.map((q) => q.id),
  //   };
  // }

  async update(id: number, dto: UpdateQuizDto, userId: number) {
    const quiz = await this.findOne(id);

    // Extract reason for changelog (don't save it in quiz)
    // const { reason, ...quizData } = dto;
    Object.assign(quiz, dto);
    await this.quizRepo.save(quiz);
    // Create changelog entry
    await this.changelogService.createLog({
      changeType: 'quiz',
      changeTypeId: id,
      userId: userId,
      //   reason,
    });

    // Return only id and title
    const result = await this.quizRepo.findOne({
      where: { id },
      select: {
        id: true,
        title: true,
        no_of_questions: true,
        desc: true,
        total_marks: true,
      },
    });

    if (!result) {
      throw new NotFoundException(`quiz with ID ${id} not found after update`);
    }

    return result;
  }

  async findOne(id: number) {
    const quiz = await this.quizRepo.findOne({ where: { id } });
    if (!quiz) {
      throw new NotFoundException(`quiz with ID ${id} not found`);
    }
    return quiz;
  }

  async findAll(search?: string){
    const options: FindManyOptions<Quiz> = {
      select: {
        id: true,
        title: true,
        desc: true
      },
      order: { title: 'ASC' },
    };

    // Add search filter if provided
    if (search) {
      options.where = { title: ILike(`%${search}%`) };
    }

    // Execute and return
    return await this.quizRepo.find(options);
  }

  async remove(id: number): Promise<{ message: string }> {
        const quiz = await this.findOne(id);
        await this.quizRepo.remove(quiz);
        return { message: `Quiz with ID ${id} has been deleted successfully` };
    }


// async assignQuizToModule(quizId: number, moduleId: number) {
//   const quiz = await this.quizRepo.findOne({ where: { id: quizId } });
//   if (!quiz) throw new NotFoundException('Quiz not found');

//   const module = await this.moduleRepo.findOne({ where: { id: moduleId }, relations: ['quiz'] });
//   if (!module) throw new NotFoundException('Module not found');

//   if (module.quiz) {
//     throw new BadRequestException('This module already has a quiz assigned');
//   }

//   quiz.module = module;
//   quiz.moduleId = module.id;
//   return this.quizRepo.save(quiz);
// }



}
