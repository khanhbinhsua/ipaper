import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { User } from './user.entity';

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
  search(tenantId: string, keyword?: string) {
    const where = keyword
      ? [
          { tenantId, isActive: true, fullName: ILike(`%${keyword}%`) },
          { tenantId, isActive: true, email: ILike(`%${keyword}%`) },
          { tenantId, isActive: true, username: ILike(`%${keyword}%`) },
        ]
      : { tenantId, isActive: true };
    return this.repo.find({ where, select: SAFE_FIELDS, take: 20 });
  }

  async updateProfile(id: string, data: Partial<User>) {
    await this.repo.update(id, data);
    return this.findById(id);
  }
}
