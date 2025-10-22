import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { DomainModule } from '../../domain-modules/entities/domain-module.entity';
import { ModuleTopic } from '../../module_topics/entities/module-topic.entity';

@Entity({ name: 'modules' })
export class Module extends BaseEntity {
  @Column({ length: 200, nullable: false })
  title: string;

  @Column({ name: 'desc', type: 'text', nullable: true })
  desc: string;

  @Column({ type: 'int', nullable: true })
  duration: number; // Duration in minutes

  @Column({ type: 'varchar', length: 50, nullable: true })
  level: string; // Beginner, Intermediate, Advanced

  // Many-to-many relationship with domains through domain_modules join table
  @OneToMany(() => DomainModule, (domainModule) => domainModule.module)
  domainModules: DomainModule[];

  // Many-to-many relationship with topics through module_topics join table
  @OneToMany(() => ModuleTopic, (moduleTopic) => moduleTopic.module)
  moduleTopics: ModuleTopic[];
}
