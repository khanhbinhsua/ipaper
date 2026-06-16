import {
  Controller, Post, Get, Delete, Param, Query, UseGuards, UseInterceptors,
  UploadedFile, Request, Res, Body, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FilesService } from './files.service';

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private service: FilesService) {}

  @Post('upload/:documentId')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Request() req,
    @Param('documentId') documentId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { isApprovalDoc?: string; note?: string },
  ) {
    if (!file) throw new BadRequestException('Thiếu file tải lên');
    if (file.size > MAX_SIZE) throw new BadRequestException('File vượt quá 25MB');
    return this.service.attach(documentId, req.user.id, file, {
      isApprovalDoc: body.isApprovalDoc === 'true',
      note: body.note,
    });
  }

  @Get('document/:documentId')
  list(@Param('documentId') documentId: string) {
    return this.service.listByDocument(documentId);
  }

  @Get(':fileId/url')
  getUrl(@Param('fileId') fileId: string) {
    return this.service.getDownloadUrl(fileId);
  }

  @Delete(':fileId')
  remove(@Param('fileId') fileId: string) {
    return this.service.remove(fileId);
  }
}
