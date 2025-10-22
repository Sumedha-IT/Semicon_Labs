import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Domain } from '../../domains/entities/domain.entity';

@Entity({ name: 'user_domains' })
@Index(['user_id', 'domain_id'], { unique: true })
export class UserDomain extends BaseEntity {
  @Column({ type: 'int' })
  user_id: number;

  @Column({ type: 'int' })
  domain_id: number;

  // Add proper relationships
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Domain, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'domain_id' })
  domain: Domain;
}
