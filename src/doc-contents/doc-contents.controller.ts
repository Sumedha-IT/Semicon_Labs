import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { DocContentsService } from './doc-contents.service';
import { CreateDocContentDto } from './dto/create-doc-content.dto';
import { UpdateDocContentDto } from './dto/update-doc-content.dto';
import { DocContentQueryDto } from './dto/doc-content-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorator/roles.decorator';
import { GetUser } from '../common/decorator/get-user.decorator';
import { UserRole } from '../common/constants/user-roles';

@Controller({ path: 'docContents', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocContentsController {
  constructor(private readonly docContentsService: DocContentsService) {}

  @Post()
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed') {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only ZIP files are allowed'), false);
        }
      },
    }),
  )
  async create(
    @Body() dto: CreateDocContentDto,
    @UploadedFile() file: Express.Multer.File,
    @GetUser('userId') userId: number,
  ) {
    if (!file) {
      throw new BadRequestException('ZIP file is required');
    }

    return this.docContentsService.create(dto, file, userId);
  }

  @Get()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  async findAll(@Query() queryDto: DocContentQueryDto, @Res() res: Response) {
    // Check if any advanced query params are provided
    const hasAdvancedQuery =
      queryDto.topicId ||
      queryDto.page ||
      queryDto.limit ||
      queryDto.sortBy ||
      queryDto.sortOrder;

    // Use advanced filtering if any query params are provided
    if (hasAdvancedQuery || queryDto.search) {
      const result = await this.docContentsService.findWithFilters(queryDto);

      // Return 204 No Content if no results found
      if (result.data.length === 0) {
        return res.status(HttpStatus.NO_CONTENT).send();
      }

      return res.status(HttpStatus.OK).json(result);
    }

    // Use simple query if no params provided (backward compatibility)
    const docContents = await this.docContentsService.findAll();

    // Return 204 No Content if no results found
    if (docContents.length === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    return res.status(HttpStatus.OK).json(docContents);
  }

  @Get('topic/:topicId')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MANAGER,
    UserRole.LEARNER,
  )
  async findByTopicId(@Param('topicId') topicId: string, @Res() res: Response) {
    const docContent = await this.docContentsService.findByTopicId(+topicId);

    if (!docContent) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    return res.status(HttpStatus.OK).json(docContent);
  }

  @Get(':id')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  async findOne(@Param('id') id: string) {
    return this.docContentsService.findOne(+id);
  }

  @Get(':id/viewUrl')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MANAGER,
    UserRole.LEARNER,
  )
  async getViewUrl(@Param('id') id: string) {
    return this.docContentsService.getViewUrl(+id);
  }

  @Patch(':id')
  @Roles(UserRole.PLATFORM_ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, cb) => {
        if (!file) {
          // No file provided - allow it (metadata-only update)
          cb(null, true);
        } else if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed') {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only ZIP files are allowed'), false);
        }
      },
    }),
  )
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDocContentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @GetUser('userId') userId: number,
  ) {
    return this.docContentsService.update(+id, dto, file, userId);
  }
}

