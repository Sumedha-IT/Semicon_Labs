import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Topic } from '../../topics/entities/topic.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'doc_contents' })
export class DocContent extends BaseEntity {
  @Column({ length: 200 })
  title: string;

  @Index()
  @Column({ name: 'topic_id' })
  topicId: number;

  @Column({ name: 'file_name', length: 255 })
  fileName: string;

  @Column({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize?: number | null;

  @Column({ name: 'file_type', length: 100, default: 'application/zip' })
  fileType: string;

  @Column({ name: 'storage_url', type: 'text' })
  storageUrl: string;

  @Column({ name: 'storage_key_prefix', length: 500 })
  storageKeyPrefix: string;

  @Column({ name: 'uploaded_by', nullable: true })
  uploadedBy?: number | null;

  // Relations
  @ManyToOne(() => Topic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'topic_id' })
  topic: Topic;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploaded_by' })
  uploader?: User;
}

