import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { Readable } from 'stream';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client: Client;
  private bucket: string;

  constructor(private config: ConfigService) {
    this.client = new Client({
      endPoint: config.get('MINIO_ENDPOINT', 'localhost'),
      port: Number(config.get('MINIO_PORT', 9100)),
      useSSL: config.get('MINIO_USE_SSL') === 'true',
      accessKey: config.get('MINIO_USER', 'minioadmin'),
      secretKey: config.get('MINIO_PASS', 'minioadmin123'),
    });
    this.bucket = config.get('MINIO_BUCKET', 'ipaper-files');
  }

  // Tạo bucket nếu chưa có khi khởi động
  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Đã tạo bucket "${this.bucket}"`);
      }
    } catch (e) {
      this.logger.error(`Không kết nối được MinIO: ${e.message}`);
    }
  }

  async upload(key: string, buffer: Buffer, mimetype: string) {
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': mimetype,
    });
    return key;
  }

  async getStream(key: string): Promise<Readable> {
    return this.client.getObject(this.bucket, key);
  }

  async getBuffer(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (c) => chunks.push(c));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  // Link tải tạm thời (mặc định 1 giờ)
  async presignedUrl(key: string, expirySeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expirySeconds);
  }

  async remove(key: string) {
    await this.client.removeObject(this.bucket, key);
  }
}
