import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

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

  @Get()
  listByTenant(@Request() req) {
    return this.usersService.findByTenant(req.user.tenantId);
  }
}
