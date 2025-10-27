/*
https://docs.nestjs.com/providers#services
*/

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QuizQuestion } from 'src/quiz-ques/quiz-question.entity';
import { In, Repository } from 'typeorm';
import { AssignOptionsDto, OptionDto } from './dtos/create-quizques-opt.dto';
import { QuizQuestionOption } from './quiz-question-options.entity';
import { UpdateQuizOptionDto } from './dtos/update-quiz.dto';
import { ChangelogService } from 'src/changelog/changelog.service';

@Injectable()
export class QuizquestionOptionsService {
  constructor(
    @InjectRepository(QuizQuestionOption)
    private readonly optionRepo: Repository<QuizQuestionOption>,

    @InjectRepository(QuizQuestion)
    private readonly questionRepo: Repository<QuizQuestion>,
    private readonly changelogService: ChangelogService,
  ) {}

  async validateUniqueQues(option_text: string) {
    const existingTitle = await this.optionRepo.findOne({
      where: { option_text },
    });

    if (existingTitle) {
      throw new ConflictException(
        `Option "${option_text}" already exists`,
      );
    }
  }

  async create(dto: OptionDto) {
    await this.validateUniqueQues(dto.option_text);
    const option = this.optionRepo.create(dto);
    const saveQues = await this.optionRepo.save(option);
    const result = await this.optionRepo.findOne({
      where: { id: saveQues.id },
      select: {
        id: true,
        option_text: true,
        is_correct: true
      },
    });

    if (!result) {
      throw new NotFoundException('options creation failed');
    }

    return result;
  }

//   async assignOptions(dto: AssignOptionsDto) {
//   const question = await this.questionRepo.findOne({
//     where: { id: dto.quiz_question_id },
//     relations: ['options'],
//   });
//   if (!question) throw new NotFoundException('Question not found');

//   const options = await this.optionRepo.findByIds(dto.option_ids);
//   if (!options.length)
//     throw new NotFoundException('No options found for given IDs');

//   // Merge new options with existing ones
//   question.options = [...(question.options || []), ...options];

//   await this.questionRepo.save(question);

//   return {
//     message: `Assigned ${options.length} options to question ${question.id}`,
//     assignedOptionIds: options.map((o) => o.id),
//   };
// }

async assignOptions(dto: AssignOptionsDto) {
  const question = await this.questionRepo.findOne({
    where: { id: dto.quiz_question_id },
    relations: ['options'],
  });

  if (!question) throw new NotFoundException('Question not found');

  // Fetch all requested options including their current question
  const options = await this.optionRepo.find({
    where: { id: In(dto.option_ids) },
    relations: ['question'],
  });

  if (!options.length) {
    throw new NotFoundException('No options found for given IDs');
  }

  // // Validation 1️⃣: Prevent assigning option already linked to another question
  // const usedByOther = options.filter(
  //   (opt) => opt.question && opt.question.id !== question.id,
  // );
  // if (usedByOther.length > 0) {
  //   throw new BadRequestException(
  //     `Options already assigned to another question: [${usedByOther
  //       .map((o) => o.id)
  //       .join(', ')}].`,
  //   );
  // }

  // Validation 2️⃣: Avoid duplicate option assignment within the same question
  const existingOptionIds = (question.options || []).map((opt) => opt.id);
  const duplicateOptionIds = options
    .map((o) => o.id)
    .filter((id) => existingOptionIds.includes(id));

  if (duplicateOptionIds.length > 0) {
    throw new BadRequestException(
      `Options with IDs [${duplicateOptionIds.join(', ')}] are already assigned to this question.`,
    );
  }

  // Validation 3️⃣: Only one correct option per question
  const existingCorrectCount = question.options?.filter((opt) => opt.is_correct).length || 0;
const newCorrectCount = options.filter((opt) => opt.is_correct).length;
const totalCorrect = existingCorrectCount + newCorrectCount;

if (totalCorrect > 4) {
  throw new BadRequestException(
    `A question can have only up to 2 correct options. Currently total is ${totalCorrect}.`,
  );
}

if (totalCorrect === 0) {
  throw new BadRequestException(
    `Each question must have at least one correct option.`,
  );
}

  // Validation 4️⃣: Ensure maximum 4 options per question
  const totalOptions = (question.options?.length || 0) + options.length;
  if (totalOptions !== 4) {
    throw new BadRequestException(
      `A question should have 4 options only. Current total would be ${totalOptions}.`,
    );
  }

  // Assign and save
  question.options = [...(question.options || []), ...options];
  await this.questionRepo.save(question);

  return {
    message: `Assigned ${options.length} option(s) to question ${question.id}`,
    assignedOptionIds: options.map((o) => o.id),
  };
}


async getOptionById(id: number) {
  const option = await this.optionRepo.findOne({
    where: { id },
    // relations: ['question'],
  });

  if (!option) {
    throw new NotFoundException(`Option with ID ${id} not found`);
  }

  return {
    message: 'Option fetched successfully',
    data: option,
  };
}



  async findOptionsByQuestion(questionId: number) {
    return this.optionRepo.find({ where: { question: { id: questionId } } });
  }

  async updateOption(id: number, update_dto: UpdateQuizOptionDto, userId: number) {
    const option = await this.optionRepo.findOne({ where: { id } });
    if (!option) throw new NotFoundException('Option not found');

    const { reason, ...dto } = update_dto;
    Object.assign(option, dto);

    await this.changelogService.createLog({
      changeType: 'quiz-question-option',
      changeTypeId: id,
      userId: userId,
      reason,
    });
    return this.optionRepo.save(option);
  }

  async deleteOption(id: number, reason: string, userId: number) {
  const option = await this.optionRepo.findOne({
    where: { id },
    relations: ['question'],
  });
  if (!option) throw new NotFoundException('Option not found');
  if (option.question) {
    option.question = null;
    await this.optionRepo.save(option);
  }

  // Now remove the option row itself
  await this.optionRepo.remove(option);
   await this.changelogService.createLog({
      changeType: 'quiz-question-option',
      changeTypeId: id,
      userId: userId,
      reason,
    });
  return { message: 'Option deleted and mappings removed', id };
}

}
