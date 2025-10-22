import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ChangelogService } from './changelog.service';
import { ChangeLogQueryDto } from './dto/changelog-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('changelog')
@UseGuards(JwtAuthGuard)
export class ChangelogController {
  constructor(private readonly changelogService: ChangelogService) {}

  @Get()
  async findAll(@Query() queryDto: ChangeLogQueryDto) {
    return this.changelogService.findAll(queryDto);
  }
}

