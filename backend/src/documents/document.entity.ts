import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';
import { Workflow } from '../workflows/workflow.entity';
import { DocumentFile } from './document-file.entity';
import { Approval } from './approval.entity';

export enum DocumentStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RETURNED = 'returned',
}

export enum DocumentPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant)
  tenant: Tenant;

  @Column()
  tenantId: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  docType: string; // loại yêu cầu

  @Column({ type: 'enum', enum: DocumentPriority, default: DocumentPriority.NORMAL })
  priority: DocumentPriority;

  @Column({ type: 'enum', enum: DocumentStatus, default: DocumentStatus.DRAFT })
  status: DocumentStatus;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  orgUnit: string; // bộ phận

  @Column({ nullable: true })
  dueDate: Date;

  // Người tạo
  @ManyToOne(() => User)
  createdBy: User;

  @Column()
  createdById: string;

  // Người đang cần xử lý (current assignee)
  @ManyToOne(() => User, { nullable: true })
  assignedTo: User;

  @Column({ nullable: true })
  assignedToId: string;

  // CC — lưu dạng mảng userId
  @Column({ type: 'jsonb', default: [] })
  ccUserIds: string[];

  @ManyToOne(() => Workflow, { nullable: true })
  workflow: Workflow;

  @Column({ nullable: true })
  workflowId: string;

  @Column({ default: 0 })
  currentStep: number;

  // File tài liệu phê duyệt chính (có version)
  @Column({ nullable: true })
  approvalFileKey: string; // key trong MinIO

  @OneToMany(() => DocumentFile, (f) => f.document, { cascade: true })
  attachments: DocumentFile[];

  @OneToMany(() => Approval, (a) => a.document, { cascade: true })
  approvals: Approval[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
