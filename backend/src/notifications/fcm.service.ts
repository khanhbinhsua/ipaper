import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert, App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PushToken } from './push-token.entity';

/**
 * Gửi push notification qua Firebase Cloud Messaging.
 * Cần file firebase-admin.json ở backend root (hoặc set env FIREBASE_ADMIN_JSON=/path).
 * Nếu không có file → service chạy nhưng bỏ qua push (không crash — vẫn có Socket.IO realtime).
 */
@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private app: App | null = null;

  constructor(
    @InjectRepository(PushToken) private tokenRepo: Repository<PushToken>,
  ) {}

  onModuleInit() {
    const jsonPath = process.env.FIREBASE_ADMIN_JSON
      || path.join(process.cwd(), 'firebase-admin.json');
    if (!fs.existsSync(jsonPath)) {
      this.logger.warn(`Không tìm thấy ${jsonPath} — push notification TẮT (Socket.IO vẫn hoạt động)`);
      return;
    }
    try {
      const cred = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      this.app = initializeApp({ credential: cert(cred) });
      this.logger.log(`FCM sẵn sàng cho project "${cred.project_id}"`);
    } catch (e: any) {
      this.logger.error(`FCM init lỗi: ${e.message}`);
    }
  }

  // Đăng ký / cập nhật token cho user (upsert theo token)
  async registerToken(userId: string, token: string, userAgent?: string) {
    if (!token) return;
    // Nếu token đã có → gắn sang user hiện tại (user cũ trên cùng device sẽ mất → hợp lý)
    const existing = await this.tokenRepo.findOne({ where: { token } });
    if (existing) {
      existing.userId = userId;
      existing.userAgent = userAgent || existing.userAgent;
      await this.tokenRepo.save(existing);
    } else {
      await this.tokenRepo.save(this.tokenRepo.create({ userId, token, userAgent }));
    }
  }

  async unregisterToken(token: string) {
    await this.tokenRepo.delete({ token });
  }

  // Gửi push tới TẤT CẢ thiết bị của một user (in không sao — Socket.IO sẽ vẫn báo)
  async pushToUser(userId: string, title: string, body: string, data?: Record<string, string>) {
    if (!this.app) {
      this.logger.warn(`pushToUser(${userId}): FCM chưa init, bỏ qua`);
      return;
    }
    const tokens = await this.tokenRepo.find({ where: { userId } });
    this.logger.log(`pushToUser(${userId}): tìm thấy ${tokens.length} token(s)`);
    if (!tokens.length) return;
    await this.sendMany(tokens.map((t) => t.token), title, body, data);
  }

  async pushToUsers(userIds: string[], title: string, body: string, data?: Record<string, string>) {
    if (!this.app || !userIds.length) return;
    const tokens = await this.tokenRepo.find({ where: { userId: In(userIds) } });
    if (!tokens.length) return;
    await this.sendMany(tokens.map((t) => t.token), title, body, data);
  }

  private async sendMany(tokens: string[], title: string, body: string, data?: Record<string, string>) {
    if (!this.app || !tokens.length) return;
    try {
      const res = await getMessaging(this.app).sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: data ?? {},
        webpush: {
          fcmOptions: {
            link: data?.link || '/',
          },
          notification: {
            icon: '/pwa-192.png',
            badge: '/pwa-192.png',
          },
        },
      });
      this.logger.log(`FCM send: success=${res.successCount}/${tokens.length} failure=${res.failureCount}`);

      // Dọn token die (unregistered / invalid) + log lý do cho token fail khác
      const dead: string[] = [];
      res.responses.forEach((r, i) => {
        if (!r.success) {
          const code = r.error?.code || 'unknown';
          const msg = r.error?.message || '';
          this.logger.warn(`FCM fail token[${i}]: code=${code} msg=${msg}`);
          if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token') || code.includes('invalid-argument')) {
            dead.push(tokens[i]);
          }
        }
      });
      if (dead.length) {
        await this.tokenRepo.delete({ token: In(dead) });
        this.logger.log(`Dọn ${dead.length} token die`);
      }
    } catch (e: any) {
      this.logger.error(`FCM send exception: ${e.message}`, e.stack);
    }
  }
}
