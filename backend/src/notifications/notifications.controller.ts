import { Controller, Get, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService) {}

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
