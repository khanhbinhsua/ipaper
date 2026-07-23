import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { TemplatesService } from './templates.service';

@UseGuards(JwtAuthGuard)
@Controller('templates')
export class TemplatesController {
  constructor(private service: TemplatesService) {}

  @Get()
  search(@Request() req, @Query('category') category?: string, @Query('name') name?: string) {
    return this.service.search(req.user.tenantId, category, name);
  }

  @Get('categories')
  categories(@Request() req) {
    return this.service.categories(req.user.tenantId);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.service.findOne(req.user.tenantId, id);
  }

  // Tạo/sửa/xoá biểu mẫu: chỉ Admin
  @UseGuards(AdminGuard)
  @Post()
  create(@Request() req, @Body() dto: any) {
    return this.service.create(req.user.tenantId, dto);
  }

  @UseGuards(AdminGuard)
  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() dto: any) {
    return this.service.update(req.user.tenantId, id, dto);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.service.remove(req.user.tenantId, id);
  }

  // === File mẫu ===
  // Upload file mẫu (Admin)
  @UseGuards(AdminGuard)
  @Post(':id/files')
  @UseInterceptors(FileInterceptor('file'))
  addFile(@Request() req, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.service.addFile(req.user.tenantId, id, file);
  }

  // Xoá file mẫu (Admin). Query param `key` = key file trên MinIO
  @UseGuards(AdminGuard)
  @Delete(':id/files')
  removeFile(@Request() req, @Param('id') id: string, @Query('key') key: string) {
    return this.service.removeFile(req.user.tenantId, id, key);
  }

  // Lấy link tải/xem file mẫu (mọi user đã đăng nhập)
  @Get(':id/files/url')
  fileUrl(
    @Request() req,
    @Param('id') id: string,
    @Query('key') key: string,
    @Query('disposition') disposition?: 'inline' | 'attachment',
  ) {
    return this.service.fileDownloadUrl(req.user.tenantId, id, key, disposition);
  }
}
