import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from 'src/common/constants/user-roles';
import { Roles } from 'src/common/decorator/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { QuizService } from './quiz.service';
import { CreateQuizDto } from './dtos/quiz.dto';
import { UpdateQuizDto } from './dtos/update-quiz.dto';
import { GetUser } from 'src/common/decorator/get-user.decorator';
import { QuizQueryDto } from './dtos/quiz-query.dto';

@Controller({ path: 'quiz', version: '1' })
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateQuizDto) {
    return this.quizService.create(dto);
  }


  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateQuizDto,
    @GetUser('userId') userId: number,
  ) {
    return this.quizService.update(+id, dto, userId);
  }

  // @Delete(':id')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.PLATFORM_ADMIN)
  // async remove(@Param('id') id: string) {
  //   return this.quizService.remove(+id);
  // }


@UseGuards(JwtAuthGuard, RolesGuard)
@Get(':id')
@Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
async findOne(@Param('id') id: string) {
  const quiz = await this.quizService.findOne(+id);
  console.log('quiz', quiz);

  return {
    status: 200,
    message: 'Successfully fetched Quiz response',
    data: quiz,
  };
}

//   @Get()
//   @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
//   async findAll(@Query() queryDto: QuizQueryDto, @Res() res: Response) {
//     // Check if any advanced query params are provided
//     const hasAdvancedQuery =
//       queryDto.title ||
//       queryDto.quiz_type||
//       queryDto.page ||
//       queryDto.limit ||
//       queryDto.sortBy ||
//       queryDto.sortOrder;

//     // Use advanced filtering if any query params are provided
//     if (hasAdvancedQuery || queryDto.search) {
//       const result = await this.quizService.findWithFilters(queryDto);

//       // Return 204 No Content if no results found
//       if (result.data.length === 0) {
//         return res.status(HttpStatus.NO_CONTENT).send();
//       }

//       return res.status(HttpStatus.OK).json(result);
//     }

//     // Use simple query if no params provided (backward compatibility)
//     const topics = await this.topicsService.findAll();

//     // Return 204 No Content if no results found
//     if (topics.length === 0) {
//       return res.status(HttpStatus.NO_CONTENT).send();
//     }

//     return res.status(HttpStatus.OK).json(topics);
//   }
}
