import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  findByTenant(tenantId: string) {
    return this.repo.find({ where: { tenantId, isActive: true } });
  }

  async updateProfile(id: string, data: Partial<User>) {
    await this.repo.update(id, data);
    return this.findById(id);
  }
}
