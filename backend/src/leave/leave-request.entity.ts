import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Tenant } from '../tenants/tenant.entity';

export enum LeaveStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('leave_requests')
export class LeaveRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant)
  tenant: Tenant;

  @Column()
  tenantId: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  userId: string;

  @Column()
  leaveType: string; // phép năm, nghỉ ốm, nghỉ không lương…

  @Column({ type: 'date' })
  fromDate: string;

  @Column({ default: false })
  halfAm: boolean; // nghỉ buổi sáng ngày fromDate

  @Column({ type: 'date' })
  toDate: string;

  @Column({ default: false })
  halfPm: boolean; // nghỉ buổi chiều ngày toDate

  @Column({ type: 'enum', enum: LeaveStatus, default: LeaveStatus.PENDING })
  status: LeaveStatus;

  @Column({ nullable: true })
  approverComment: string;

  @ManyToOne(() => User, { nullable: true })
  approvedBy: User;

  @Column({ nullable: true })
  approvedById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
