import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AssignmentsService } from './assignments.service';

@UseGuards(JwtAuthGuard)
@Controller('assignments')
export class AssignmentsController {
  constructor(private service: AssignmentsService) {}

  @Get()
  search(@Request() req, @Query() dto: any) {
    return this.service.search(req.user.tenantId, req.user.id, req.user.role, dto);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.service.findOne(req.user.tenantId, req.user.id, req.user.role, id);
  }

  @Post()
  create(@Request() req, @Body() dto: any) {
    return this.service.create(req.user.tenantId, req.user.id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Request() req, @Param('id') id: string, @Body() dto: any) {
    return this.service.updateStatus(req.user.tenantId, req.user.id, id, dto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.service.remove(req.user.tenantId, req.user.id, id);
  }
}
