import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Tenant } from './tenants/tenant.entity';
import { User, UserRole } from './users/user.entity';

/**
 * Khởi tạo production AN TOÀN (idempotent — KHÔNG xóa dữ liệu).
 * Tạo 1 tenant + 1 tài khoản admin nếu chưa tồn tại.
 * Chạy: docker compose -f docker-compose.prod.yml exec backend node dist/init.js
 *
 * Cấu hình qua biến môi trường (có giá trị mặc định):
 *   INIT_TENANT_SLUG, INIT_TENANT_NAME, INIT_ADMIN_USER, INIT_ADMIN_PASS, INIT_ADMIN_EMAIL
 */
async function init() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);
  const tenantRepo = ds.getRepository(Tenant);
  const userRepo = ds.getRepository(User);

  const slug = process.env.INIT_TENANT_SLUG || 'DKGroup';
  const tenantName = process.env.INIT_TENANT_NAME || 'DK Group';
  const adminUser = process.env.INIT_ADMIN_USER || 'admin';
  const adminPass = process.env.INIT_ADMIN_PASS || 'Admin@123';
  const adminEmail = process.env.INIT_ADMIN_EMAIL || 'admin@ipaper.local';

  let tenant = await tenantRepo.findOne({ where: { slug } });
  if (!tenant) {
    tenant = await tenantRepo.save(tenantRepo.create({ slug, name: tenantName, isActive: true }));
    console.log(`✅ Đã tạo tổ chức: ${slug} (${tenantName})`);
  } else {
    console.log(`• Tổ chức "${slug}" đã tồn tại`);
  }

  const existed = await userRepo.findOne({ where: { username: adminUser, tenantId: tenant.id } });
  if (!existed) {
    await userRepo.save(userRepo.create({
      tenantId: tenant.id,
      username: adminUser,
      email: adminEmail,
      password: await bcrypt.hash(adminPass, 10),
      fullName: 'Quản trị viên',
      role: UserRole.ADMIN,
      isActive: true,
    }));
    console.log(`✅ Đã tạo admin: ${adminUser} / ${adminPass}  (tenant: ${slug})`);
    console.log('   ⚠️  Hãy đổi mật khẩu admin ngay sau khi đăng nhập!');
  } else {
    console.log(`• Admin "${adminUser}" đã tồn tại — bỏ qua`);
  }

  await app.close();
  process.exit(0);
}

init().catch((e) => { console.error('Init lỗi:', e); process.exit(1); });
