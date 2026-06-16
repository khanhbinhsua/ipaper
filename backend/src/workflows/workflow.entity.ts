import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';

export interface WorkflowStep {
  order: number;
  name: string;       // vd: "Trưởng phòng duyệt"
  roleRequired: string; // vd: "approver"
}

@Entity('workflows')
export class Workflow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant)
  tenant: Tenant;

  @Column()
  tenantId: string;

  @Column()
  name: string;

  @Column({ type: 'jsonb' })
  steps: WorkflowStep[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
