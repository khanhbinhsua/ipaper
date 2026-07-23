import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  // === File đính kèm ===
  @Post(':id/files')
  @UseInterceptors(FileInterceptor('file'))
  addFile(@Request() req, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.service.addFile(req.user.tenantId, req.user.id, id, file);
  }

  @Delete(':id/files')
  removeFile(@Request() req, @Param('id') id: string, @Query('key') key: string) {
    return this.service.removeFile(req.user.tenantId, req.user.id, id, key);
  }

  @Get(':id/files/url')
  fileUrl(
    @Request() req,
    @Param('id') id: string,
    @Query('key') key: string,
    @Query('disposition') disposition?: 'inline' | 'attachment',
  ) {
    return this.service.fileDownloadUrl(
      req.user.tenantId, req.user.id, req.user.role, id, key, disposition,
    );
  }
}
