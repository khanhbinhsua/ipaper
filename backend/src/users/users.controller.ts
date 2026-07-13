import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { UsersService } from './users.service';
import { UserRole } from './user.entity';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getMe(@Request() req) {
    return this.usersService.findById(req.user.id);
  }

  @Patch('me')
  updateMe(@Request() req, @Body() body: { notifyWeb?: boolean; notifyEmail?: boolean; avatar?: string }) {
    return this.usersService.updateProfile(req.user.id, body);
  }

  @Get('search')
  search(@Request() req, @Query('q') q?: string, @Query('role') role?: string) {
    return this.usersService.search(req.user.tenantId, q, role);
  }

  @Get()
  listByTenant(@Request() req) {
    return this.usersService.findByTenant(req.user.tenantId);
  }

  // ===== Quản trị (chỉ admin) =====
  @UseGuards(AdminGuard)
  @Get('admin/all')
  listAll(@Request() req) {
    return this.usersService.listAll(req.user.tenantId);
  }

  @UseGuards(AdminGuard)
  @Post('admin')
  create(@Request() req, @Body() dto: {
    username: string; email: string; password: string;
    fullName?: string; orgUnit?: string; role?: UserRole;
  }) {
    return this.usersService.createUser(req.user.tenantId, dto);
  }

  @UseGuards(AdminGuard)
  @Patch('admin/:id')
  adminUpdate(@Request() req, @Param('id') id: string, @Body() dto: any) {
    return this.usersService.adminUpdate(req.user.tenantId, id, dto);
  }
}
