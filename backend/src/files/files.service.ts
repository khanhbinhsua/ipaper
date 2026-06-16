import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { DocumentFile } from '../documents/document-file.entity';
import { MinioService } from './minio.service';

interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(DocumentFile) private fileRepo: Repository<DocumentFile>,
    private minio: MinioService,
  ) {}

  async attach(documentId: string, userId: string, file: UploadedFile, opts?: { isApprovalDoc?: boolean; note?: string }) {
    const ext = file.originalname.includes('.') ? file.originalname.split('.').pop() : 'bin';
    const storageKey = `${documentId}/${uuid()}.${ext}`;
    await this.minio.upload(storageKey, file.buffer, file.mimetype);

    // Versioning: nếu là tài liệu phê duyệt, tăng version
    let version = 1;
    if (opts?.isApprovalDoc) {
      const last = await this.fileRepo.findOne({
        where: { documentId, isApprovalDoc: true },
        order: { version: 'DESC' },
      });
      version = (last?.version ?? 0) + 1;
    }

    const entity = this.fileRepo.create({
      documentId, uploadedById: userId,
      filename: file.originalname, mimetype: file.mimetype, size: file.size,
      storageKey, version,
      isApprovalDoc: opts?.isApprovalDoc ?? false,
      note: opts?.note,
    });
    return this.fileRepo.save(entity);
  }

  async listByDocument(documentId: string) {
    return this.fileRepo.find({ where: { documentId }, order: { createdAt: 'DESC' } });
  }

  async getDownloadUrl(fileId: string) {
    const file = await this.fileRepo.findOne({ where: { id: fileId } });
    if (!file) throw new NotFoundException('Tài liệu không tồn tại');
    const url = await this.minio.presignedUrl(file.storageKey);
    return { url, filename: file.filename };
  }

  async remove(fileId: string) {
    const file = await this.fileRepo.findOne({ where: { id: fileId } });
    if (!file) throw new NotFoundException('Tài liệu không tồn tại');
    await this.minio.remove(file.storageKey);
    await this.fileRepo.remove(file);
    return { message: 'Đã xóa tài liệu' };
  }
}
