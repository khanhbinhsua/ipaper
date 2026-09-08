import { Controller, Get, Patch, Post, Delete, Param, Body, UseGuards, Request, Headers } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { FcmService } from './fcm.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService, private fcm: FcmService) {}

  // Đăng ký FCM token của thiết bị hiện tại vào user đăng nhập
  @Post('push-token')
  registerToken(@Request() req, @Body() body: { token: string }, @Headers('user-agent') ua: string) {
    return this.fcm.registerToken(req.user.id, body.token, ua);
  }

  @Delete('push-token/:token')
  unregisterToken(@Param('token') token: string) {
    return this.fcm.unregisterToken(token);
  }

  @Get()
  list(@Request() req) {
    return this.service.list(req.user.id);
  }

  @Get('unread-count')
  unread(@Request() req) {
    return this.service.unreadCount(req.user.id);
  }

  @Patch('read-all')
  readAll(@Request() req) {
    return this.service.markAllRead(req.user.id);
  }

  @Patch(':id/read')
  read(@Request() req, @Param('id') id: string) {
    return this.service.markRead(req.user.id, id);
  }
}
