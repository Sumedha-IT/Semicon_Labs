import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Quiz } from './quiz.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, ILike, Repository } from 'typeorm';
import { ChangelogService } from 'src/changelog/changelog.service';
import { CreateQuizDto } from './dtos/quiz.dto';
import { UpdateQuizDto } from './dtos/update-quiz.dto';

@Injectable()
export class QuizService {
  constructor(
    @InjectRepository(Quiz)
    private readonly quizRepo: Repository<Quiz>,
    private readonly changelogService: ChangelogService,
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
    const result = await this.quizRepo.findOne({
      where: { id: saveQuiz.id },
      select: {
        id: true,
        title: true,
        no_of_questions: true,
        desc: true,
        total_marks: true,
      },
    });

    if (!result) {
      throw new NotFoundException('quiz creation failed');
    }

    return result;
  }

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

}
