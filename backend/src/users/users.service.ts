import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './user.entity';

// Các field an toàn để trả về client (không bao gồm password)
const SAFE_FIELDS = {
  id: true, username: true, email: true, fullName: true, orgUnit: true,
  avatar: true, role: true, notifyWeb: true, notifyEmail: true,
  isDomainUser: true, tenantId: true, isActive: true,
} as const;

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  findById(id: string) {
    return this.repo.findOne({ where: { id }, select: SAFE_FIELDS });
  }

  findByTenant(tenantId: string) {
    return this.repo.find({ where: { tenantId, isActive: true }, select: SAFE_FIELDS });
  }

  // Tìm người dùng theo tên/email/username để chọn (chuyển tới, người liên quan, người duyệt)
  // role: lọc theo vai trò (vd 'director'); orgUnit: lọc theo phòng ban;
  // ids: lấy đúng các user theo id (dùng để hiển thị lại tên cho value đã chọn từ trước)
  search(tenantId: string, keyword?: string, role?: string, orgUnit?: string, ids?: string) {
    // Ưu tiên: nếu client cần lấy user theo id → không giới hạn 20 và bỏ qua role/orgUnit filter
    if (ids) {
      const idList = ids.split(',').map((s) => s.trim()).filter(Boolean);
      if (!idList.length) return [];
      return this.repo.find({ where: { id: In(idList), tenantId }, select: SAFE_FIELDS });
    }
    const base: any = { tenantId, isActive: true };
    if (role) base.role = role;
    if (orgUnit) base.orgUnit = ILike(orgUnit); // khớp không phân biệt hoa/thường
    const where = keyword
      ? [
          { ...base, fullName: ILike(`%${keyword}%`) },
          { ...base, email: ILike(`%${keyword}%`) },
          { ...base, username: ILike(`%${keyword}%`) },
        ]
      : base;
    return this.repo.find({ where, select: SAFE_FIELDS, take: 20 });
  }

  async updateProfile(id: string, data: Partial<User>) {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  // ===== Quản trị (admin) =====
  async createUser(tenantId: string, dto: {
    username: string; email: string; password: string;
    fullName?: string; orgUnit?: string; role?: UserRole;
  }) {
    const exists = await this.repo.findOne({ where: [{ username: dto.username }, { email: dto.email }] });
    if (exists) throw new BadRequestException('Tên đăng nhập hoặc email đã tồn tại');
    if (!dto.password || dto.password.length < 6) {
      throw new BadRequestException('Mật khẩu tối thiểu 6 ký tự');
    }
    const user = this.repo.create({
      tenantId,
      username: dto.username,
      email: dto.email,
      password: await bcrypt.hash(dto.password, 10),
      fullName: dto.fullName,
      orgUnit: dto.orgUnit,
      role: dto.role ?? UserRole.STAFF,
      isDomainUser: false,
      isActive: true,
    });
    await this.repo.save(user);
    return this.findById(user.id);
  }

  async adminUpdate(tenantId: string, id: string, dto: {
    fullName?: string; orgUnit?: string; role?: UserRole;
    isActive?: boolean; password?: string;
  }) {
    const user = await this.repo.findOne({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('Người dùng không tồn tại');
    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.orgUnit !== undefined) user.orgUnit = dto.orgUnit;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.password) {
      if (dto.password.length < 6) throw new BadRequestException('Mật khẩu tối thiểu 6 ký tự');
      user.password = await bcrypt.hash(dto.password, 10);
    }
    await this.repo.save(user);
    return this.findById(id);
  }

  // Danh sách đầy đủ cho trang quản trị (gồm cả user bị khóa)
  listAll(tenantId: string) {
    return this.repo.find({ where: { tenantId }, select: SAFE_FIELDS, order: { createdAt: 'DESC' } });
  }
}
