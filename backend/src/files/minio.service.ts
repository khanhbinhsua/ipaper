import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { Readable } from 'stream';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client: Client;        // nội bộ — upload/download/bucket
  private publicClient: Client;  // ký presigned URL theo endpoint công khai (trình duyệt truy cập)
  private bucket: string;

  constructor(private config: ConfigService) {
    const accessKey = config.get('MINIO_USER', 'minioadmin');
    const secretKey = config.get('MINIO_PASS', 'minioadmin123');
    // Đặt region cố định → minio-js KHÔNG gọi network để hỏi bucket region khi ký presigned URL
    const region = config.get('MINIO_REGION', 'us-east-1');

    this.client = new Client({
      endPoint: config.get('MINIO_ENDPOINT', 'localhost'),
      port: Number(config.get('MINIO_PORT', 9100)),
      useSSL: config.get('MINIO_USE_SSL') === 'true',
      region,
      accessKey, secretKey,
    });

    // Nếu có endpoint công khai (production) → dùng để ký presigned URL.
    const publicEndpoint = config.get('MINIO_PUBLIC_ENDPOINT');
    this.publicClient = publicEndpoint
      ? new Client({
          endPoint: publicEndpoint,
          port: Number(config.get('MINIO_PUBLIC_PORT', 443)),
          useSSL: config.get('MINIO_PUBLIC_USE_SSL', 'true') === 'true',
          region,
          accessKey, secretKey,
        })
      : this.client;

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

  // Link tải tạm thời (mặc định 1 giờ). reqParams cho phép set Content-Disposition...
  // Ký bằng publicClient để URL trỏ tới endpoint công khai (trình duyệt truy cập được).
  async presignedUrl(key: string, expirySeconds = 3600, reqParams?: Record<string, string>): Promise<string> {
    return this.publicClient.presignedGetObject(this.bucket, key, expirySeconds, reqParams);
  }

  async remove(key: string) {
    await this.client.removeObject(this.bucket, key);
  }
}
