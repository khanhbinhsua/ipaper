import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne,
} from 'typeorm';
import { Document } from './document.entity';
import { User } from '../users/user.entity';

@Entity('document_files')
export class DocumentFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Document, (d) => d.attachments, { onDelete: 'CASCADE' })
  document: Document;

  @Column()
  documentId: string;

  @Column()
  filename: string;

  @Column()
  mimetype: string;

  @Column()
  size: number; // bytes

  @Column()
  storageKey: string; // path trong MinIO

  @Column({ default: 1 })
  version: number;

  @Column({ default: false })
  isApprovalDoc: boolean; // true = tài liệu phê duyệt chính

  @Column({ nullable: true })
  note: string;

  @ManyToOne(() => User)
  uploadedBy: User;

  @Column()
  uploadedById: string;

  @CreateDateColumn()
  createdAt: Date;
}
