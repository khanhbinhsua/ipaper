import {
  Controller, Get, Post, Body, Param, Delete, Query, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { SearchDocumentDto } from './dto/search-document.dto';

@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private service: DocumentsService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateDocumentDto) {
    return this.service.create(req.user.tenantId, req.user.id, dto);
  }

  @Post(':id/submit')
  submit(@Request() req, @Param('id') id: string) {
    return this.service.submit(req.user.tenantId, req.user.id, id);
  }

  @Post(':id/approve')
  approve(@Request() req, @Param('id') id: string, @Body() body: { comment?: string; nextAssigneeId?: string }) {
    return this.service.approve(req.user.tenantId, req.user.id, id, body.comment, body.nextAssigneeId);
  }

  @Post(':id/reject')
  reject(@Request() req, @Param('id') id: string, @Body() body: { comment?: string }) {
    return this.service.reject(req.user.tenantId, req.user.id, id, body.comment);
  }

  @Post(':id/return')
  returnDoc(@Request() req, @Param('id') id: string, @Body() body: { comment?: string }) {
    return this.service.return(req.user.tenantId, req.user.id, id, body.comment);
  }

  @Get('statistics')
  statistics(@Request() req, @Query('fromDate') from?: string, @Query('toDate') to?: string) {
    return this.service.statistics(req.user.tenantId, req.user.id, from, to);
  }

  @Get('search')
  search(@Request() req, @Query() dto: SearchDocumentDto) {
    return this.service.search(req.user.tenantId, req.user.id, dto);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.service.findOne(req.user.tenantId, id);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.service.remove(req.user.tenantId, req.user.id, id);
  }
}
