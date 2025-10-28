import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainModule } from './entities/domain-module.entity';
import { Domain } from '../domains/entities/domain.entity';
import { Module as ModuleEntity } from '../modules/entities/module.entity';

@Injectable()
export class DomainModulesService {
  constructor(
    @InjectRepository(DomainModule)
    private readonly domainModuleRepository: Repository<DomainModule>,
    @InjectRepository(Domain)
    private readonly domainRepository: Repository<Domain>,
    @InjectRepository(ModuleEntity)
    private readonly moduleRepository: Repository<ModuleEntity>,
  ) {}

  /**
   * Link modules to a domain
   */
  async linkModules(domainId: number, moduleIds: number[]) {
    // Validate domain exists
    const domain = await this.domainRepository.findOne({
      where: { id: domainId },
    });
    if (!domain) {
      throw new NotFoundException(`Domain with ID ${domainId} not found`);
    }

    // Validate modules exist
    const invalidModules = await this.validateModulesExist(moduleIds);
    if (invalidModules.length > 0) {
      throw new BadRequestException(
        `Modules not found: ${invalidModules.join(', ')}`,
      );
    }

    // Get existing links
    const existing = await this.domainModuleRepository.find({
      where: { domain_id: domainId },
    });
    const existingModuleIds = existing.map((dm) => dm.module_id);

    // Check for already linked modules
    const alreadyLinked = moduleIds.filter((id) =>
      existingModuleIds.includes(id),
    );

    if (alreadyLinked.length === moduleIds.length) {
      throw new ConflictException(
        `Module${moduleIds.length > 1 ? 's' : ''} ${moduleIds.join(', ')} ${moduleIds.length > 1 ? 'are' : 'is'} already linked with this domain`,
      );
    }

    // Filter out already linked modules
    const newModuleIds = moduleIds.filter(
      (id) => !existingModuleIds.includes(id),
    );

    const domainLinks = newModuleIds.map((moduleId) =>
      this.domainModuleRepository.create({
        domain_id: domainId,
        module_id: moduleId,
      }),
    );
    await this.domainModuleRepository.save(domainLinks);

    // Build informative message
    let message = `Module${newModuleIds.length > 1 ? 's' : ''} ${newModuleIds.join(', ')} linked successfully`;

    if (alreadyLinked.length > 0) {
      message += `. Module${alreadyLinked.length > 1 ? 's' : ''} ${alreadyLinked.join(', ')} ${alreadyLinked.length > 1 ? 'were' : 'was'} already linked`;
    }

  return { message };
}


  /**
   * Get all modules linked to a domain
   */
  async getDomainModules(domainId: number) {
    const domain = await this.domainRepository.findOne({
      where: { id: domainId },
      relations: {
        domainModules: {
          module: true,
        },
      },
    });

    if (!domain) {
      throw new NotFoundException(`Domain with ID ${domainId} not found`);
    }

    // Map modules from relations
    return domain.domainModules.map((dm) => ({
      id: dm.module.id,
      title: dm.module.title,
      desc: dm.module.desc,
      duration: dm.module.duration,
      level: dm.module.level,
    }));
  }

  /**
   * Get a specific module within a domain
   */
  async getDomainModule(domainId: number, moduleId: number) {
    // Validate domain exists
    const domain = await this.domainRepository.findOne({
      where: { id: domainId },
    });
    if (!domain) {
      throw new NotFoundException(`Domain with ID ${domainId} not found`);
    }

    // Validate module exists
    const module = await this.moduleRepository.findOne({
      where: { id: moduleId },
    });
    if (!module) {
      throw new NotFoundException(`Module with ID ${moduleId} not found`);
    }

    // Check if the module is linked to the domain
    const domainModule = await this.domainModuleRepository.findOne({
      where: {
        domain_id: domainId,
        module_id: moduleId,
      },
    });

    if (!domainModule) {
      throw new NotFoundException(
        `Module ${moduleId} is not linked to domain ${domainId}`,
      );
    }

    return {
      id: module.id,
      title: module.title,
      desc: module.desc,
      duration: module.duration,
      level: module.level,
    };
  }

  /**
   * Validates that multiple modules exist
   * @returns Array of invalid module IDs
   */
  private async validateModulesExist(moduleIds: number[]): Promise<number[]> {
    const modules = await this.moduleRepository
      .createQueryBuilder('m')
      .where('m.id IN (:...ids)', { ids: moduleIds })
      .getMany();

    const validIds = modules.map((m) => m.id);
    const invalidIds = moduleIds.filter((id) => !validIds.includes(id));

    return invalidIds;
  }
}
