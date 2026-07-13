import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Tenant } from './tenants/tenant.entity';
import { User, UserRole } from './users/user.entity';
import { Document, DocumentStatus, DocumentPriority } from './documents/document.entity';
import { Template } from './templates/template.entity';

/**
 * Seed dữ liệu demo. Chạy: npm run seed
 * Tài khoản demo (tenant "demo"):
 *   - nhanvien / 123456A@  (người tạo hồ sơ)
 *   - truongphong / 123456A@  (người duyệt)
 */
async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);

  const tenantRepo = ds.getRepository(Tenant);
  const userRepo = ds.getRepository(User);
  const docRepo = ds.getRepository(Document);
  const tplRepo = ds.getRepository(Template);

  // Xóa data cũ (theo thứ tự FK)
  await ds.query('TRUNCATE TABLE approvals, document_files, documents, notifications, users, templates, workflows, tenants RESTART IDENTITY CASCADE');

  // Tenant
  const tenant = await tenantRepo.save(
    tenantRepo.create({ slug: 'demo', name: 'Văn phòng Demo', isActive: true }),
  );

  const pass = await bcrypt.hash('123456A@', 10);

  const staff = await userRepo.save(
    userRepo.create({
      tenantId: tenant.id, username: 'nhanvien', email: 'nhanvien@ipaper.vn',
      password: pass, fullName: 'Nguyễn Văn Nhân', orgUnit: 'Phòng Kế toán',
      role: UserRole.STAFF, isDomainUser: false,
    }),
  );

  const manager = await userRepo.save(
    userRepo.create({
      tenantId: tenant.id, username: 'truongphong', email: 'truongphong@ipaper.vn',
      password: pass, fullName: 'Trần Thị Trưởng', orgUnit: 'Phòng Kế toán',
      role: UserRole.STAFF, isDomainUser: false,
    }),
  );

  const admin = await userRepo.save(
    userRepo.create({
      tenantId: tenant.id, username: 'admin', email: 'admin@ipaper.vn',
      password: pass, fullName: 'Quản trị viên', orgUnit: 'CNTT',
      role: UserRole.ADMIN, isDomainUser: false,
    }),
  );

  // Sample documents
  await docRepo.save([
    docRepo.create({
      tenantId: tenant.id, title: 'Đề xuất mua sắm văn phòng phẩm Q3',
      docType: 'Đề xuất', priority: DocumentPriority.NORMAL,
      status: DocumentStatus.PENDING, currentStep: 1,
      createdById: staff.id, assignedToId: manager.id,
      orgUnit: 'Phòng Kế toán', description: 'Mua sắm bút, giấy, mực in cho quý 3',
      ccUserIds: [admin.id],
    }),
    docRepo.create({
      tenantId: tenant.id, title: 'Tờ trình nâng cấp hệ thống',
      docType: 'Tờ trình', priority: DocumentPriority.HIGH,
      status: DocumentStatus.APPROVED, currentStep: 1,
      createdById: staff.id, orgUnit: 'CNTT',
    }),
    docRepo.create({
      tenantId: tenant.id, title: 'Yêu cầu thanh toán công tác phí',
      docType: 'Thanh toán', priority: DocumentPriority.URGENT,
      status: DocumentStatus.DRAFT, currentStep: 0,
      createdById: staff.id, orgUnit: 'Phòng Kế toán',
    }),
    docRepo.create({
      tenantId: tenant.id, title: 'Đề nghị cấp thiết bị làm việc',
      docType: 'Đề nghị', priority: DocumentPriority.LOW,
      status: DocumentStatus.REJECTED, currentStep: 1,
      createdById: staff.id, orgUnit: 'CNTT',
    }),
  ]);

  // Biểu mẫu (templates)
  await tplRepo.save([
    tplRepo.create({ tenantId: tenant.id, name: 'Đơn đề xuất mua sắm', category: 'Hành chính', docType: 'Đề xuất' }),
    tplRepo.create({ tenantId: tenant.id, name: 'Tờ trình phê duyệt', category: 'Hành chính', docType: 'Tờ trình' }),
    tplRepo.create({ tenantId: tenant.id, name: 'Yêu cầu thanh toán', category: 'Kế toán', docType: 'Thanh toán' }),
    tplRepo.create({ tenantId: tenant.id, name: 'Đề nghị tạm ứng', category: 'Kế toán', docType: 'Tạm ứng' }),
    tplRepo.create({ tenantId: tenant.id, name: 'Đề nghị cấp thiết bị CNTT', category: 'CNTT', docType: 'Đề nghị' }),
  ]);

  console.log('\n✅ Seed thành công!');
  console.log('Tenant: demo');
  console.log('Tài khoản (mật khẩu: 123456A@):');
  console.log('  - nhanvien     (người tạo hồ sơ)');
  console.log('  - truongphong  (người duyệt — có hồ sơ chờ duyệt)');
  console.log('  - admin        (quản trị)\n');

  await app.close();
  process.exit(0);
}

seed().catch((e) => {
  console.error('Seed lỗi:', e);
  process.exit(1);
});
