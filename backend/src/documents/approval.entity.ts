import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne,
} from 'typeorm';
import { Document } from './document.entity';
import { User } from '../users/user.entity';

export enum ApprovalAction {
  SUBMIT = 'submit',
  APPROVE = 'approve',
  REJECT = 'reject',
  RETURN = 'return',
  SAVE_DRAFT = 'save_draft',
  COMPLETE = 'complete',
  CONSULT = 'consult',
}

@Entity('approvals')
export class Approval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Document, (d) => d.approvals, { onDelete: 'CASCADE' })
  document: Document;

  @Column()
  documentId: string;

  @Column({ type: 'enum', enum: ApprovalAction })
  action: ApprovalAction;

  @Column()
  step: number;

  @Column({ nullable: true })
  comment: string;

  @ManyToOne(() => User)
  actor: User;

  @Column()
  actorId: string;

  @CreateDateColumn()
  createdAt: Date;
}
