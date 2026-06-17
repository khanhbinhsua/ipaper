// Ép Node chạy ở UTC để khớp với Postgres (container UTC) — tránh lệch giờ
// khi đọc/ghi cột timestamp. Frontend sẽ tự đổi sang giờ địa phương (GMT+7).
process.env.TZ = 'UTC';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`iPaper backend running on http://localhost:${port}/api`);
}
bootstrap();
