import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Template } from './template.entity';

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
    await this.repo.remove(tpl);
    return { message: 'Đã xóa biểu mẫu' };
  }
}
