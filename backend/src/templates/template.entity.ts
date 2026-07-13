import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Workflow } from '../workflows/workflow.entity';

@Entity('templates')
export class Template {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant)
  tenant: Tenant;

  @Column()
  tenantId: string;

  @Column()
  name: string;

  @Column()
  category: string; // danh mục biểu mẫu

  @Column({ nullable: true })
  docType: string;

  @ManyToOne(() => Workflow, { nullable: true })
  workflow: Workflow;

  @Column({ nullable: true })
  workflowId: string;

  // Preset để điền sẵn vào hồ sơ khi nhân viên tạo từ mẫu
  @Column({ type: 'text', nullable: true })
  description: string; // nội dung mẫu

  @Column({ nullable: true })
  orgUnit: string; // bộ phận mặc định

  @Column({ nullable: true })
  priority: string; // low/normal/high/urgent

  @Column({ nullable: true })
  assignedToId: string; // Chuyển tới 1 (bắt buộc trong hồ sơ)

  @Column({ type: 'jsonb', default: [] })
  nextApproverIds: string[]; // Chuyển tới 2..4

  @Column({ type: 'jsonb', default: [] })
  ccUserIds: string[]; // Người liên quan

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
