import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { NotificationsGateway } from './notifications.gateway';
import { FcmService } from './fcm.service';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private repo: Repository<Notification>,
    private gateway: NotificationsGateway,
    private fcm: FcmService,
  ) {}

  // Tạo + đẩy realtime (Socket.IO cho app đang mở) + push FCM (cho app đóng)
  async notify(userId: string, message: string, documentId?: string) {
    const noti = await this.repo.save(
      this.repo.create({ userId, message, documentId }),
    );
    this.gateway.pushToUser(userId, noti);
    // Push FCM song song, không await (không chặn flow chính nếu FCM chậm)
    const link = documentId ? `/documents/${documentId}` : '/';
    this.fcm.pushToUser(userId, 'iPaper', message, { link, documentId: documentId || '' })
      .catch(() => { /* đã log trong service, không throw */ });
    return noti;
  }

  list(userId: string) {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  unreadCount(userId: string) {
    return this.repo.count({ where: { userId, isRead: false } });
  }

  async markRead(userId: string, id: string) {
    await this.repo.update({ id, userId }, { isRead: true });
    return { message: 'ok' };
  }

  async markAllRead(userId: string) {
    await this.repo.update({ userId, isRead: false }, { isRead: true });
    return { message: 'ok' };
  }
}
