import { Entity, Column, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { DomainModule } from '../../domain-modules/entities/domain-module.entity';

@Entity({ name: 'domains' })
export class Domain extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @OneToMany(() => DomainModule, (dm: DomainModule) => dm.domain)
  domainModules: DomainModule[];
}
