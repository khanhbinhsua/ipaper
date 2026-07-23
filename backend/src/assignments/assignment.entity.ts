import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';

export enum AssignmentType {
  TASK = 'task',      // Giao việc (cấp trên → cấp dưới, nội bộ)
  COLLAB = 'collab',  // Phối hợp (giữa các bộ phận)
}

export enum AssignmentStatus {
  PENDING = 'pending',           // Chưa nhận / chưa xử lý
  IN_PROGRESS = 'in_progress',   // Đang làm
  DONE = 'done',                 // Hoàn thành
  CANCELLED = 'cancelled',       // Đã huỷ
}

export enum AssignmentPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('assignments')
export class Assignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant)
  tenant: Tenant;

  @Column()
  tenantId: string;

  @Column({ nullable: true })
  code: string; // Mã: GV-YYYYMMDD-#### (task) hoặc PH-YYYYMMDD-#### (collab)

  @Column({ type: 'enum', enum: AssignmentType })
  type: AssignmentType;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // Người giao / khởi tạo
  @ManyToOne(() => User)
  assigner: User;

  @Column()
  assignerId: string;

  // Người nhận (thực hiện)
  @ManyToOne(() => User)
  assignee: User;

  @Column()
  assigneeId: string;

  // Bộ phận từ / tới — chủ yếu dùng cho collab (phối hợp)
  @Column({ nullable: true })
  fromOrgUnit: string;

  @Column({ nullable: true })
  toOrgUnit: string;

  @Column({ type: 'enum', enum: AssignmentPriority, default: AssignmentPriority.NORMAL })
  priority: AssignmentPriority;

  @Column({ type: 'enum', enum: AssignmentStatus, default: AssignmentStatus.PENDING })
  status: AssignmentStatus;

  @Column({ type: 'timestamp', nullable: true })
  dueDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  // Ghi chú người nhận cập nhật khi thay đổi trạng thái
  @Column({ type: 'text', nullable: true })
  progressNote: string;

  // File đính kèm để người nhận biết ngữ cảnh (tài liệu, biểu mẫu, tham chiếu...)
  @Column({ type: 'jsonb', default: [] })
  attachments: Array<{ key: string; originalName: string; size: number; mimeType: string; uploadedAt: string }>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
