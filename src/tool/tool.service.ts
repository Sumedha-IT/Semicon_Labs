import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Tool } from './tool.entity';
import { CreateToolDto } from './dtos/create-tool.dto';
import { UpdateToolDto } from './dtos/update-tool.dto';
import { AssignToolDto, SwitchToolDto } from './dtos/assign-tool.dto';
import { UserTool } from 'src/user-tool/user-tool.entity';
import { UserDomain } from 'src/user-domains/entities/user-domain.entity';
import { ChangelogService } from 'src/changelog/changelog.service';

@Injectable()
export class ToolService {
  constructor(
    @InjectRepository(Tool)
    private readonly toolRepo: Repository<Tool>,
    @InjectRepository(UserTool)
    private readonly userToolRepo: Repository<UserTool>,
    @InjectRepository(UserDomain)
    private readonly userDomainRepo: Repository<UserDomain>,
    private readonly changelogService: ChangelogService,
  ) {}

  async createTool(dto: CreateToolDto) {
    const existing = await this.toolRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new BadRequestException('Tool name already exists');
    const tool = this.toolRepo.create(dto);
    return this.toolRepo.save(tool);
  }

  async updateTool(id: number, update_dto: UpdateToolDto, userId: number) {
    const tool = await this.toolRepo.findOne({ where: { id } });
    if (!tool) throw new NotFoundException('Tool not found');
    // Extract reason for changelog (don't save it in domain)
    const { reason, ...dto } = update_dto;
    Object.assign(tool, dto);

    // Create changelog entry
    await this.changelogService.createLog({
      changeType: 'tool',
      changeTypeId: id,
      userId: userId,
      reason,
    });
    return this.toolRepo.save(tool);
  }

  async getAllTools() {
    return this.toolRepo.find({ order: { created_on: 'DESC' } });
  }

  async getToolById(id: number) {
    const tool = await this.toolRepo.findOne({ where: { id } });
    if (!tool) throw new NotFoundException('Tool not found');
    return tool;
  }

  async getToolByName(name: string) {
    console.log('name', name);
    const tool = await this.toolRepo.findOne({
      where: { name: ILike(`%${name}%`) },
    });
    if (!tool) throw new NotFoundException('Tool not found');
    return tool;
  }

  // async deleteTool(id: number) {
  //   const tool = await this.toolRepo.findOne({ where: { id } });
  //   if (!tool) throw new NotFoundException('Tool not found');
  //   await this.toolRepo.remove(tool);
  //   return { message: 'Tool deleted successfully' };
  // }

  // async assignToolToUser(assign_dto: AssignToolDto, userId: number) {
  //   const { reason, ...dto } = assign_dto;

  //   const tool = await this.toolRepo.findOne({ where: { id: dto.tool_id } });
  //   if (!tool) throw new NotFoundException('Tool not found');

  //   //  Check if user is enrolled in this domain
  //   const userDomain = await this.userDomainRepo.findOne({
  //     where: { id: dto.user_domain_id },
  //   });

  //   if (!userDomain) {
  //     throw new BadRequestException(
  //       'User is not enrolled in any domain or invalid domain ID',
  //     );
  //   }

  //   // Check if user already has a tool assigned
  //   const existingAssignment = await this.userToolRepo.findOne({
  //     where: { user_domain_id: dto.user_domain_id },
  //     relations: ['tool'],
  //   });

  //   // if user has no previous tool, allow assignment
  //   if (!existingAssignment) {
  //     const userTool = this.userToolRepo.create({
  //       tool,
  //       user_domain_id: dto.user_domain_id,
  //     });
  //     return this.userToolRepo.save(userTool);
  //   }

  //   // Prevent assigning the same tool again
  //   if (existingAssignment.tool.id === dto.tool_id) {
  //     throw new BadRequestException('This tool is already assigned to this user.');
  //   }

  //   // Ensure at least 30 days have passed since last tool assignment
  //   const lastUpdated = existingAssignment.updated_on;
  //   const now = new Date();
  //   const diffInDays =
  //     (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);

  //   if (diffInDays < 30) {
  //     throw new BadRequestException(
  //       `You can switch tools only after 30 days. ${
  //         Math.ceil(30 - diffInDays)
  //       } day(s) remaining.`,
  //     );
  //   }

  //   // Update the tool assignment after 30 days
  //   existingAssignment.tool = tool;
  //   existingAssignment.updated_on = new Date();

  //    // Create changelog entry
  //   await this.changelogService.createLog({
  //     changeType: 'tool',
  //     changeTypeId: userDomain.user_id,
  //     userId: userId,
  //     reason,
  //   });

  //   return this.userToolRepo.save(existingAssignment);
  // }
  async assignToolToUser(data: AssignToolDto) {
    const tool = await this.toolRepo.findOne({ where: { id: data.tool_id } });
    if (!tool) throw new NotFoundException('Tool not found');

    // Check if user is enrolled in this domain
    const userDomain = await this.userDomainRepo.findOne({
      where: { id: data.user_domain_id },
    });
    if (!userDomain) {
      throw new BadRequestException('Invalid or unenrolled domain.');
    }

    //  Check if user already has a tool assigned
    const existing = await this.userToolRepo.findOne({
      where: { user_domain_id: data.user_domain_id },
    });

    if (existing) {
      throw new BadRequestException('User already has a tool assigned.');
    }

    // Create new assignment
    const userTool = this.userToolRepo.create({
      tool,
      user_domain_id: data.user_domain_id,
    });
    const saved = await this.userToolRepo.save(userTool);

    return { message: 'Tool assigned successfully.', data: saved };
  }

  async switchUserTool(dto: SwitchToolDto, userId: number) {
    const { reason, ...data } = dto;

    const tool = await this.toolRepo.findOne({ where: { id: data.tool_id } });
    if (!tool) throw new NotFoundException('Tool not found');

    // ✅ Check if user is enrolled in this domain
    const userDomain = await this.userDomainRepo.findOne({
      where: { id: data.user_domain_id },
    });
    if (!userDomain) {
      throw new BadRequestException('Invalid or unenrolled domain.');
    }

    // ✅ Ensure user already has a tool
    const existing = await this.userToolRepo.findOne({
      where: { user_domain_id: data.user_domain_id },
      relations: ['tool'],
    });

    if (!existing) {
      throw new BadRequestException(
        'User does not have any tool assigned yet. Please use assignToolToUser API first.',
      );
    }

    // ✅ Prevent reassigning same tool
    if (existing.tool.id === data.tool_id) {
      throw new BadRequestException(
        'This tool is already assigned to the user.',
      );
    }

    // ✅ Ensure 30 days have passed since last update
    const lastUpdated = existing.updated_on;
    const now = new Date();
    const diffInDays =
      (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);

    if (diffInDays < 30) {
      throw new BadRequestException(
        `You can switch tools only after 30 days. ${Math.ceil(30 - diffInDays)} day(s) remaining.`,
      );
    }

    // ✅ Perform the switch
    existing.tool = tool;
    existing.updated_on = new Date();
    const saved = await this.userToolRepo.save(existing);

    // 🧾 Log the change
    await this.changelogService.createLog({
      changeType: 'user-tool',
      changeTypeId: userDomain.user_id,
      userId,
      reason,
    });

    return { message: 'Tool switched successfully.', data: saved };
  }
}
