import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { UserDomain } from './entities/user-domain.entity';
import { Domain } from '../domains/entities/domain.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class UserDomainsService {
  constructor(
    @InjectRepository(UserDomain)
    private readonly repo: Repository<UserDomain>,
    @InjectRepository(Domain)
    private readonly domainRepo: Repository<Domain>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  // ----------------------------------------------------------------------------
  // 1. LINK/UNLINK OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Links a user to multiple domains
   * Validates user and domains exist, handles duplicates and existing links
   * @returns Object with linked, skipped, invalid domain IDs
   */
  async link(
    userId: number,
    domainIds: number[],
  ): Promise<{
    linked: number[];
    skipped: number[];
    invalid: number[];
    duplicates?: number[];
  }> {
    // Validate user exists
    await this.validateUserExists(userId);

    // Remove duplicates and track them
    const uniqueDomainIds = [...new Set(domainIds)];
    const duplicates =
      domainIds.length !== uniqueDomainIds.length
        ? domainIds.filter((id, index) => domainIds.indexOf(id) !== index)
        : [];

    // Validate which domains exist
    const validDomains = await this.domainRepo.find({
      where: uniqueDomainIds.map((id) => ({ id })),
    });

    const validDomainIds = validDomains.map((domain) => domain.id);
    const invalidDomainIds = uniqueDomainIds.filter(
      (id) => !validDomainIds.includes(id),
    );

    // If no valid domains, return early
    if (validDomainIds.length === 0) {
      return {
        linked: [],
        skipped: [],
        invalid: invalidDomainIds,
        ...(duplicates.length > 0 && { duplicates }),
      };
    }

    // Check which valid domains are already linked
    const existingLinks = await this.repo.find({
      where: validDomainIds.map((domainId) => ({
        user_id: userId,
        domain_id: domainId,
      })),
    });

    const existingDomainIds = existingLinks.map((link) => link.domain_id);
    const newDomainIds = validDomainIds.filter(
      (id) => !existingDomainIds.includes(id),
    );

    // If no new domains to link, return early
    if (newDomainIds.length === 0) {
      return {
        linked: [],
        skipped: existingDomainIds,
        invalid: invalidDomainIds,
        ...(duplicates.length > 0 && { duplicates }),
      };
    }

    // Insert new domain links using insert with orIgnore
    const values = newDomainIds.map((id) => ({
      user_id: userId,
      domain_id: id,
    }));
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(UserDomain)
      .values(values)
      .orIgnore()
      .execute();

    return {
      linked: newDomainIds,
      skipped: existingDomainIds,
      invalid: invalidDomainIds,
      ...(duplicates.length > 0 && { duplicates }),
    };
  }

  /**
   * Unlinks a user from a domain
   * Validates both user and domain exist before unlinking
   */
  async unlink(
    userId: number,
    domainId: number,
  ): Promise<{ success: boolean; message: string }> {
    // Validate both user and domain exist in parallel
    await this.validateUserAndDomainExist(userId, domainId);

    // Check if the relationship exists before deleting
    const result = await this.repo.delete({
      user_id: userId,
      domain_id: domainId,
    });

    if (result.affected === 0) {
      return {
        success: false,
        message: `User ${userId} is not linked to domain ${domainId}`,
      };
    }

    return {
      success: true,
      message: `Successfully unlinked user ${userId} from domain ${domainId}`,
    };
  }

  // ----------------------------------------------------------------------------
  // 2. QUERY OPERATIONS
  // ----------------------------------------------------------------------------

  /**
   * Lists all domains assigned to a user
   * Returns domain details: id, name, description
   */
  async listUserDomains(
    userId: number,
  ): Promise<Array<{ id: number; name: string; description: string | null }>> {
    // Validate user exists
    await this.validateUserExists(userId);

    // Use entity objects with relations
    const userDomains = await this.repo.find({
      where: { user_id: userId },
      relations: { domain: true },
      order: { domain: { name: 'ASC' } },
    });

    // Map to response format
    return userDomains.map((ud) => ({
      id: ud.domain.id,
      name: ud.domain.name,
      description: ud.domain.description ?? null,
    }));
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  // ----------------------------------------------------------------------------
  // Validation Helpers
  // ----------------------------------------------------------------------------

  /**
   * Validates that a user exists and is active
   * @throws NotFoundException if user doesn't exist or is deleted
   */
  private async validateUserExists(userId: number): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { user_id: userId, deleted_on: IsNull() },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
  }

  /**
   * Validates that a domain exists
   * @throws NotFoundException if domain doesn't exist
   */
  private async validateDomainExists(domainId: number): Promise<void> {
    const domain = await this.domainRepo.findOne({ where: { id: domainId } });

    if (!domain) {
      throw new NotFoundException(`Domain with ID ${domainId} not found`);
    }
  }

  /**
   * Validates that both user and domain exist
   * @throws NotFoundException with combined error message if either doesn't exist
   */
  private async validateUserAndDomainExist(
    userId: number,
    domainId: number,
  ): Promise<void> {
    // Check both in parallel for better performance
    const [user, domain] = await Promise.all([
      this.userRepo.findOne({
        where: { user_id: userId, deleted_on: IsNull() },
      }),
      this.domainRepo.findOne({ where: { id: domainId } }),
    ]);

    // Build comprehensive error message
    const errors: string[] = [];

    if (!user) {
      errors.push(`User with ID ${userId} not found`);
    }

    if (!domain) {
      errors.push(`Domain with ID ${domainId} not found`);
    }

    // If either resource doesn't exist, throw error with all details
    if (errors.length > 0) {
      throw new NotFoundException(errors.join('. '));
    }
  }
}
