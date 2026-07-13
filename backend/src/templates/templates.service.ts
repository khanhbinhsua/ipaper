import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Template } from './template.entity';
import { MinioService } from '../files/minio.service';

interface CreateTemplateDto {
  name: string;
  category: string;
  docType?: string;
  workflowId?: string;
  // Preset fields
  description?: string;
  orgUnit?: string;
  priority?: string;
  assignedToId?: string;
  nextApproverIds?: string[];
  ccUserIds?: string[];
}

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(Template) private repo: Repository<Template>,
    private minio: MinioService,
  ) {}

  // Tìm biểu mẫu theo danh mục + tên (Hình 19)
  search(tenantId: string, category?: string, name?: string) {
    const where: any = { tenantId, isActive: true };
    if (category) where.category = category;
    if (name) where.name = ILike(`%${name}%`);
    return this.repo.find({ where, order: { category: 'ASC', name: 'ASC' } });
  }

  categories(tenantId: string) {
    return this.repo
      .createQueryBuilder('t')
      .select('DISTINCT t.category', 'category')
      .where('t.tenantId = :tenantId AND t.isActive = true', { tenantId })
      .getRawMany()
      .then((rows) => rows.map((r) => r.category));
  }

  findOne(tenantId: string, id: string) {
    return this.repo.findOne({ where: { id, tenantId }, relations: { workflow: true } });
  }

  // === Quản trị ===
  create(tenantId: string, dto: CreateTemplateDto) {
    return this.repo.save(this.repo.create({
      ...dto,
      tenantId,
      nextApproverIds: dto.nextApproverIds ?? [],
      ccUserIds: dto.ccUserIds ?? [],
    }));
  }

  async update(tenantId: string, id: string, dto: Partial<CreateTemplateDto> & { isActive?: boolean }) {
    const tpl = await this.repo.findOne({ where: { id, tenantId } });
    if (!tpl) throw new NotFoundException('Biểu mẫu không tồn tại');
    Object.assign(tpl, dto);
    return this.repo.save(tpl);
  }

  async remove(tenantId: string, id: string) {
    const tpl = await this.repo.findOne({ where: { id, tenantId } });
    if (!tpl) throw new NotFoundException('Biểu mẫu không tồn tại');
    // Xoá file mẫu trên MinIO
    for (const f of tpl.templateFiles ?? []) {
      try { await this.minio.remove(f.key); } catch { /* ignore */ }
    }
    await this.repo.remove(tpl);
    return { message: 'Đã xóa biểu mẫu' };
  }

  // === File mẫu (Admin) ===
  async addFile(tenantId: string, id: string, file: Express.Multer.File) {
    const tpl = await this.repo.findOne({ where: { id, tenantId } });
    if (!tpl) throw new NotFoundException('Biểu mẫu không tồn tại');
    // Multer nhận filename dạng latin1 (multipart) → decode utf8 cho đúng tiếng Việt
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const key = `templates/${id}/${uuid()}-${originalName}`;
    await this.minio.upload(key, file.buffer, file.mimetype);
    tpl.templateFiles = [...(tpl.templateFiles ?? []), {
      key, originalName, size: file.size, mimeType: file.mimetype,
    }];
    return this.repo.save(tpl);
  }

  async removeFile(tenantId: string, id: string, key: string) {
    const tpl = await this.repo.findOne({ where: { id, tenantId } });
    if (!tpl) throw new NotFoundException('Biểu mẫu không tồn tại');
    tpl.templateFiles = (tpl.templateFiles ?? []).filter((f) => f.key !== key);
    try { await this.minio.remove(key); } catch { /* ignore */ }
    return this.repo.save(tpl);
  }

  async fileDownloadUrl(tenantId: string, id: string, key: string) {
    const tpl = await this.repo.findOne({ where: { id, tenantId } });
    if (!tpl) throw new NotFoundException('Biểu mẫu không tồn tại');
    const file = (tpl.templateFiles ?? []).find((f) => f.key === key);
    if (!file) throw new NotFoundException('File mẫu không tồn tại');
    // RFC 5987 để tên file tiếng Việt không lỗi
    const filename = encodeURIComponent(file.originalName);
    const url = await this.minio.presignedUrl(key, 3600, {
      'response-content-disposition': `attachment; filename*=UTF-8''${filename}`,
    });
    return { url };
  }
}
