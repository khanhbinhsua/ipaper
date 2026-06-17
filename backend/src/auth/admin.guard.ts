import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

// Chỉ cho phép tài khoản role 'admin'. Dùng kèm JwtAuthGuard.
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (req.user?.role !== 'admin') {
      throw new ForbiddenException('Chỉ quản trị viên được phép thao tác');
    }
    return true;
  }
}
