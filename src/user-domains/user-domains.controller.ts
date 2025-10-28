import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  Res,
  Request,
} from '@nestjs/common';
import { Response } from 'express';
import { UserDomainsService } from './user-domains.service';
import { LinkUserToDomainsDto, UserDomainQueryDto } from './dto/user-domain.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorator/roles.decorator';
import { UserRole } from '../common/constants/user-roles';

@Controller({ path: 'users', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserDomainsController {
  constructor(private readonly userDomainsService: UserDomainsService) {}

  @Post(':id/domains/link')
  @Roles(UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async linkDomains(
    @Param('id') id: string,
    @Body() body: LinkUserToDomainsDto,
  ) {
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    // This will throw NotFoundException if user doesn't exist
    const result = await this.userDomainsService.link(userId, body.domainIds);

    // Calculate unique domain IDs from request
    const uniqueRequestedIds = [...new Set(body.domainIds)];

    // If there are invalid domains, return error with complete information
    if (result.invalid.length > 0) {
      const errorMessages: string[] = [];
      errorMessages.push(
        `Invalid domain(s) - do not exist: [${result.invalid.join(', ')}]`,
      );

      if (result.duplicates && result.duplicates.length > 0) {
        errorMessages.push(
          `Duplicate domain IDs found in request: [${[...new Set(result.duplicates)].join(', ')}]`,
        );
      }

      if (result.skipped.length > 0) {
        errorMessages.push(
          `Domain(s) already linked to user ${userId}: [${result.skipped.join(', ')}]`,
        );
      }

      if (result.linked.length > 0) {
        errorMessages.push(
          `Successfully linked ${result.linked.length} domain(s): [${result.linked.join(', ')}]`,
        );
      }

      throw new BadRequestException({
        message: errorMessages.join('. '),
        invalidDomains: result.invalid,
        duplicateDomains: result.duplicates
          ? [...new Set(result.duplicates)]
          : undefined,
        alreadyLinked: result.skipped,
        successfullyLinked: result.linked,
        validationError: true,
      });
    }

    // Build detailed message for successful operations
    let message = '';
    const messages: string[] = [];

    if (result.linked.length > 0) {
      messages.push(
        `Successfully linked ${result.linked.length} domain(s): [${result.linked.join(', ')}]`,
      );
    }

    if (result.skipped.length > 0) {
      messages.push(
        `Skipped ${result.skipped.length} domain(s) - already linked to user ${userId}: [${result.skipped.join(', ')}]`,
      );
    }

    if (result.duplicates && result.duplicates.length > 0) {
      messages.push(
        `Note: ${result.duplicates.length} duplicate ID(s) were removed from request: [${[...new Set(result.duplicates)].join(', ')}]`,
      );
    }

    message = messages.join('. ');

    return {
      success: true,
      message,
      userId,
      linked: result.linked,
      skipped: result.skipped,
      duplicates: result.duplicates
        ? [...new Set(result.duplicates)]
        : undefined,
      totalRequested: body.domainIds.length,
      totalUnique: uniqueRequestedIds.length,
      totalLinked: result.linked.length,
      totalSkipped: result.skipped.length,
    };
  }

  @Get(':id/modules')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.LEARNER)
  async getUserModules(
    @Param('id') id: string,
    @Query() queryDto: any,
    @Request() req,
    @Res() res: Response,
  ) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    // Check if user has access to view this user's modules
    if (req.user.role === UserRole.LEARNER && req.user.userId !== userId) {
      throw new BadRequestException('Users can only view their own modules');
    }

    // Get user modules using the user domains service
    const result = await this.userDomainsService.getUserModules(userId, queryDto);

    // Return 204 No Content if no modules found
    if (result.data.length === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    return res.status(HttpStatus.OK).json(result);
  }

  @Get(':id/domains')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  async listUserDomains(
    @Param('id') id: string,
    @Query() query: UserDomainQueryDto,
    @Res() res: Response,
  ) {
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    // This will throw NotFoundException if user doesn't exist
    const result = await this.userDomainsService.listUserDomains(userId, query);

    // Return 204 No Content if no domains linked
    if (result.data.length === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    return res.status(HttpStatus.OK).json(result);
  }

  @Get(':id/domains/:domainId')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER)
  async getUserDomain(
    @Param('id') id: string,
    @Param('domainId') domainId: string,
  ) {
    const userId = parseInt(id, 10);
    const domainIdNum = parseInt(domainId, 10);

    if (isNaN(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    if (isNaN(domainIdNum)) {
      throw new BadRequestException('Invalid domain ID');
    }

    return this.userDomainsService.getUserDomain(userId, domainIdNum);
  }

}

