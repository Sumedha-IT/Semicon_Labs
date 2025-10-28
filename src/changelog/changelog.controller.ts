import { Controller, Get, Query, UseGuards, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ChangelogService } from './changelog.service';
import { ChangeLogQueryDto } from './dto/changelog-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('changelog')
@UseGuards(JwtAuthGuard)
export class ChangelogController {
  constructor(private readonly changelogService: ChangelogService) {}

  @Get()
  async findAll(@Query() queryDto: ChangeLogQueryDto, @Res() res: Response) {
    const result = await this.changelogService.findAll(queryDto);

    // Return 204 No Content if no data in response
    if (result.data.length === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    return res.status(HttpStatus.OK).json(result);
  }
}

