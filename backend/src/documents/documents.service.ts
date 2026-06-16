import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Document, DocumentStatus } from './document.entity';
import { Approval, ApprovalAction } from './approval.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { SearchDocumentDto } from './dto/search-document.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document) private docRepo: Repository<Document>,
    @InjectRepository(Approval) private approvalRepo: Repository<Approval>,
    private notifications: NotificationsService,
  ) {}

  // Tạo nháp hoặc tạo mới
  async create(tenantId: string, userId: string, dto: CreateDocumentDto) {
    const doc = this.docRepo.create({
      ...dto,
      tenantId,
      createdById: userId,
      status: DocumentStatus.DRAFT,
      ccUserIds: dto.ccUserIds ?? [],
    });
    return this.docRepo.save(doc);
  }

  // Gửi duyệt — chuyển từ nháp sang pending
  async submit(tenantId: string, userId: string, docId: string) {
    const doc = await this.getOwned(tenantId, userId, docId);
    doc.status = DocumentStatus.PENDING;
    doc.currentStep = 1;
    await this.docRepo.save(doc);
    await this.logApproval(docId, userId, ApprovalAction.SUBMIT, doc.currentStep);
    if (doc.assignedToId) {
      await this.notifications.notify(doc.assignedToId, `Bạn có hồ sơ mới cần duyệt: "${doc.title}"`, doc.id);
    }
    return doc;
  }

  async findOne(tenantId: string, docId: string) {
    const doc = await this.docRepo.findOne({
      where: { id: docId, tenantId },
      relations: {
        attachments: true, approvals: true, createdBy: true,
        assignedTo: true, workflow: true,
      },
    });
    if (!doc) throw new NotFoundException('Hồ sơ không tồn tại');
    return doc;
  }

  async remove(tenantId: string, userId: string, docId: string) {
    const doc = await this.getOwned(tenantId, userId, docId);
    if (doc.status !== DocumentStatus.DRAFT) {
      throw new ForbiddenException('Chỉ xóa được hồ sơ nháp');
    }
    await this.docRepo.remove(doc);
    return { message: 'Đã xóa hồ sơ' };
  }

  // Tìm kiếm theo box (inbox/outbox/draft/related/all)
  async search(tenantId: string, userId: string, dto: SearchDocumentDto) {
    const page = Number(dto.page) || 1;
    const pageSize = Number(dto.pageSize) || 10;

    const qb = this.docRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.createdBy', 'createdBy')
      .leftJoinAndSelect('d.assignedTo', 'assignedTo')
      .where('d.tenantId = :tenantId', { tenantId });

    switch (dto.box) {
      case 'inbox':
        qb.andWhere('d.assignedToId = :userId', { userId })
          .andWhere('d.status = :pending', { pending: DocumentStatus.PENDING });
        break;
      case 'outbox':
        qb.andWhere('d.createdById = :userId', { userId })
          .andWhere('d.status != :draft', { draft: DocumentStatus.DRAFT });
        break;
      case 'draft':
        qb.andWhere('d.createdById = :userId', { userId })
          .andWhere('d.status = :draft', { draft: DocumentStatus.DRAFT });
        break;
      case 'related':
        qb.andWhere('d.ccUserIds @> :ccUser', { ccUser: JSON.stringify([userId]) });
        break;
      // 'all' — không filter thêm
    }

    if (dto.keyword) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('d.title ILIKE :kw', { kw: `%${dto.keyword}%` })
            .orWhere('d.description ILIKE :kw', { kw: `%${dto.keyword}%` });
        }),
      );
    }
    if (dto.priority) qb.andWhere('d.priority = :priority', { priority: dto.priority });
    if (dto.docType) qb.andWhere('d.docType = :docType', { docType: dto.docType });
    if (dto.status) qb.andWhere('d.status = :status', { status: dto.status });
    if (dto.orgUnit) qb.andWhere('d.orgUnit = :orgUnit', { orgUnit: dto.orgUnit });
    if (dto.workflowId) qb.andWhere('d.workflowId = :wf', { wf: dto.workflowId });
    if (dto.fromDate) qb.andWhere('d.createdAt >= :from', { from: dto.fromDate });
    if (dto.toDate) qb.andWhere('d.createdAt <= :to', { to: dto.toDate });

    qb.orderBy('d.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  // Thống kê cho dashboard
  async statistics(tenantId: string, userId: string, fromDate?: string, toDate?: string) {
    const base = () => {
      const qb = this.docRepo
        .createQueryBuilder('d')
        .where('d.tenantId = :tenantId', { tenantId });
      if (fromDate) qb.andWhere('d.createdAt >= :from', { from: fromDate });
      if (toDate) qb.andWhere('d.createdAt <= :to', { to: toDate });
      return qb;
    };

    const [inbox, outbox, draft, related, approved, rejected, pending, total] = await Promise.all([
      base().clone().andWhere('d.assignedToId = :userId AND d.status = :s', { userId, s: DocumentStatus.PENDING }).getCount(),
      base().clone().andWhere('d.createdById = :userId AND d.status != :d', { userId, d: DocumentStatus.DRAFT }).getCount(),
      base().clone().andWhere('d.createdById = :userId AND d.status = :d', { userId, d: DocumentStatus.DRAFT }).getCount(),
      base().clone().andWhere('d.ccUserIds @> :ccUser', { ccUser: JSON.stringify([userId]) }).getCount(),
      base().clone().andWhere('d.status = :s', { s: DocumentStatus.APPROVED }).getCount(),
      base().clone().andWhere('d.status = :s', { s: DocumentStatus.REJECTED }).getCount(),
      base().clone().andWhere('d.status = :s', { s: DocumentStatus.PENDING }).getCount(),
      base().clone().getCount(),
    ]);

    return {
      counters: { inbox, outbox, draft, related },
      chart: { approved, rejected, pending, total },
    };
  }

  // ===== WORKFLOW ACTIONS =====

  // Duyệt — chuyển cho người duyệt kế tiếp, hoặc hoàn thành nếu là bước cuối
  async approve(tenantId: string, userId: string, docId: string, comment?: string, nextAssigneeId?: string) {
    const doc = await this.getAssigned(tenantId, userId, docId);
    await this.logApproval(docId, userId, ApprovalAction.APPROVE, doc.currentStep, comment);

    if (nextAssigneeId) {
      // Còn người duyệt tiếp theo
      doc.currentStep += 1;
      doc.assignedToId = nextAssigneeId;
      doc.status = DocumentStatus.PENDING;
      await this.docRepo.save(doc);
      await this.notifications.notify(nextAssigneeId, `Bạn có hồ sơ mới cần duyệt: "${doc.title}"`, doc.id);
    } else {
      // Bước cuối → hoàn thành
      doc.status = DocumentStatus.APPROVED;
      doc.assignedToId = null as any;
      await this.docRepo.save(doc);
      await this.notifications.notify(doc.createdById, `Hồ sơ "${doc.title}" đã được duyệt hoàn tất`, doc.id);
    }
    return doc;
  }

  // Từ chối — kết thúc quy trình
  async reject(tenantId: string, userId: string, docId: string, comment?: string) {
    const doc = await this.getAssigned(tenantId, userId, docId);
    doc.status = DocumentStatus.REJECTED;
    doc.assignedToId = null as any;
    await this.docRepo.save(doc);
    await this.logApproval(docId, userId, ApprovalAction.REJECT, doc.currentStep, comment);
    await this.notifications.notify(doc.createdById, `Hồ sơ "${doc.title}" đã bị từ chối`, doc.id);
    return doc;
  }

  // Trả về — trả lại người tạo (hoặc bước trước) để bổ sung
  async return(tenantId: string, userId: string, docId: string, comment?: string) {
    const doc = await this.getAssigned(tenantId, userId, docId);
    doc.status = DocumentStatus.RETURNED;
    doc.assignedToId = doc.createdById; // trả về người tạo
    doc.currentStep = 0;
    await this.docRepo.save(doc);
    await this.logApproval(docId, userId, ApprovalAction.RETURN, doc.currentStep, comment);
    await this.notifications.notify(doc.createdById, `Hồ sơ "${doc.title}" đã được trả về để bổ sung`, doc.id);
    return doc;
  }

  private async getOwned(tenantId: string, userId: string, docId: string) {
    const doc = await this.docRepo.findOne({ where: { id: docId, tenantId } });
    if (!doc) throw new NotFoundException('Hồ sơ không tồn tại');
    if (doc.createdById !== userId) throw new ForbiddenException('Không có quyền');
    return doc;
  }

  private async getAssigned(tenantId: string, userId: string, docId: string) {
    const doc = await this.docRepo.findOne({ where: { id: docId, tenantId } });
    if (!doc) throw new NotFoundException('Hồ sơ không tồn tại');
    if (doc.assignedToId !== userId) {
      throw new ForbiddenException('Bạn không phải người duyệt hồ sơ này');
    }
    return doc;
  }

  private logApproval(docId: string, actorId: string, action: ApprovalAction, step: number, comment?: string) {
    return this.approvalRepo.save(
      this.approvalRepo.create({ documentId: docId, actorId, action, step, comment }),
    );
  }
}
