import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { Tenant } from '../tenants/tenant.entity';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Tenant) private tenantRepo: Repository<Tenant>,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const tenant = await this.tenantRepo.findOne({ where: { slug: dto.tenantSlug, isActive: true } });
    if (!tenant) throw new UnauthorizedException('Tenant không tồn tại');

    const user = await this.userRepo.findOne({
      where: { username: dto.username, tenantId: tenant.id, isActive: true },
      select: {
        id: true, username: true, email: true, fullName: true, orgUnit: true,
        avatar: true, role: true, notifyWeb: true, notifyEmail: true,
        isDomainUser: true, password: true, tenantId: true,
      },
    });

    if (!user) throw new UnauthorizedException('Tài khoản không tồn tại');

    if (user.isDomainUser) {
      const ok = await this.verifyLdap(dto.username, dto.password);
      if (!ok) throw new UnauthorizedException('Sai mật khẩu');
    } else {
      const ok = await bcrypt.compare(dto.password, user.password!);
      if (!ok) throw new UnauthorizedException('Sai mật khẩu');
    }

    const payload = { sub: user.id, tenantId: tenant.id, role: user.role };
    const token = this.jwtService.sign(payload);

    const { password, ...userSafe } = user as any;
    return { accessToken: token, user: userSafe };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: { id: true, isDomainUser: true, password: true },
    });

    if (!user) throw new UnauthorizedException();

    if (user.isDomainUser) {
      throw new ForbiddenException('Tài khoản domain không đổi mật khẩu tại đây');
    }

    const ok = await bcrypt.compare(dto.currentPassword, user.password!);
    if (!ok) throw new BadRequestException('Mật khẩu hiện tại không đúng');

    const same = await bcrypt.compare(dto.newPassword, user.password!);
    if (same) throw new BadRequestException('Mật khẩu mới không được giống mật khẩu cũ');

    user.password = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepo.save(user);
    return { message: 'Đổi mật khẩu thành công' };
  }

  // Placeholder — tích hợp ldapjs sau
  private async verifyLdap(username: string, password: string): Promise<boolean> {
    return false;
  }
}
