import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

// Lưu FCM registration token của từng thiết bị/trình duyệt user đăng nhập
// 1 user có thể có nhiều token (nhiều thiết bị / nhiều trình duyệt)
@Entity('push_tokens')
@Index(['token'], { unique: true })
export class PushToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column({ type: 'text' })
  token: string;

  @Column({ nullable: true })
  userAgent: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
