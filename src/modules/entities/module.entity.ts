import { Entity, Column, OneToMany, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { DomainModule } from '../../domain-modules/entities/domain-module.entity';
import { ModuleTopic } from '../../module_topics/entities/module-topic.entity';
import { Quiz } from 'src/quiz/quiz.entity';

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

  @OneToOne(() => Quiz, quiz => quiz.module, { cascade: true, eager: false })
  @JoinColumn()
  quiz: Quiz;
}
