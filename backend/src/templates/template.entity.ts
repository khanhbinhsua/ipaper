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

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
