import {
  Controller, Get, Post, Body, Param, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LeaveService } from './leave.service';
import { CreateLeaveDto } from './dto/create-leave.dto';

@UseGuards(JwtAuthGuard)
@Controller('leave')
export class LeaveController {
  constructor(private service: LeaveService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateLeaveDto) {
    return this.service.create(req.user.tenantId, req.user.id, dto);
  }

  @Get('mine')
  mine(@Request() req) {
    return this.service.myRequests(req.user.tenantId, req.user.id);
  }

  @Get('pending')
  pending(@Request() req) {
    return this.service.pendingForApprover(req.user.tenantId, req.user.id);
  }

  @Post(':id/approve')
  approve(@Request() req, @Param('id') id: string, @Body() body: { comment?: string }) {
    return this.service.approve(req.user.tenantId, req.user.id, id, body.comment);
  }

  @Post(':id/reject')
  reject(@Request() req, @Param('id') id: string, @Body() body: { comment?: string }) {
    return this.service.reject(req.user.tenantId, req.user.id, id, body.comment);
  }
}
