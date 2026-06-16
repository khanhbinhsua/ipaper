import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Document, DocumentStatus } from './document.entity';
import { Approval, ApprovalAction } from './approval.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { SearchDocumentDto } from './dto/search-document.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { DocumentFile } from './document-file.entity';
import { MinioService } from '../files/minio.service';
import { ApprovalPdfService } from './approval-pdf.service';
import { v4 as uuid } from 'uuid';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document) private docRepo: Repository<Document>,
    @InjectRepository(Approval) private approvalRepo: Repository<Approval>,
    @InjectRepository(DocumentFile) private fileRepo: Repository<DocumentFile>,
    private notifications: NotificationsService,
    private minio: MinioService,
    private approvalPdf: ApprovalPdfService,
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
        // Hồ sơ đến = đang giao cho tôi xử lý: chờ tôi duyệt (pending),
        // hoặc đã duyệt/trả về đang ở tôi để điều phối tiếp (approved/returned)
        qb.andWhere('d.assignedToId = :userId', { userId })
          .andWhere('d.status IN (:...inboxStatuses)', {
            inboxStatuses: [DocumentStatus.PENDING, DocumentStatus.APPROVED, DocumentStatus.RETURNED],
          });
        break;
      case 'outbox':
        // Hồ sơ đi = hồ sơ mà người dùng đã thao tác (gửi/duyệt/từ chối/trả về)
        qb.andWhere(
          'EXISTS (SELECT 1 FROM approvals a WHERE a."documentId" = d.id AND a."actorId" = :userId)',
          { userId },
        );
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
      base().clone().andWhere('d.assignedToId = :userId AND d.status IN (:...st)', { userId, st: [DocumentStatus.PENDING, DocumentStatus.APPROVED, DocumentStatus.RETURNED] }).getCount(),
      base().clone().andWhere('EXISTS (SELECT 1 FROM approvals a WHERE a."documentId" = d.id AND a."actorId" = :userId)', { userId }).getCount(),
      base().clone().andWhere('d.createdById = :userId AND d.status = :d', { userId, d: DocumentStatus.DRAFT }).getCount(),
      base().clone().andWhere('d.ccUserIds @> :ccUser', { ccUser: JSON.stringify([userId]) }).getCount(),
      base().clone().andWhere('d.status IN (:...ap)', { ap: [DocumentStatus.APPROVED, DocumentStatus.COMPLETED] }).getCount(),
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
      // Người duyệt chỉ định thẳng người duyệt kế tiếp
      doc.currentStep += 1;
      doc.assignedToId = nextAssigneeId;
      doc.status = DocumentStatus.PENDING;
      await this.docRepo.save(doc);
      await this.notifications.notify(nextAssigneeId, `Bạn có hồ sơ mới cần duyệt: "${doc.title}"`, doc.id);
    } else {
      // Duyệt xong cấp này → trả về người tạo để gửi tiếp cấp trên hoặc hoàn thành
      doc.status = DocumentStatus.APPROVED;
      doc.assignedToId = doc.createdById;
      await this.docRepo.save(doc);
      await this.notifications.notify(doc.createdById, `Hồ sơ "${doc.title}" đã được duyệt cấp ${doc.currentStep}. Mời gửi duyệt tiếp hoặc hoàn thành.`, doc.id);
    }
    return doc;
  }

  // Người tạo gửi hồ sơ lên cấp duyệt tiếp theo (sau khi đã được duyệt 1 cấp)
  async forward(tenantId: string, userId: string, docId: string, nextAssigneeId: string, comment?: string) {
    const doc = await this.getOwned(tenantId, userId, docId);
    if (![DocumentStatus.APPROVED, DocumentStatus.RETURNED, DocumentStatus.DRAFT].includes(doc.status)) {
      throw new ForbiddenException('Chỉ gửi duyệt tiếp khi hồ sơ đang ở người tạo');
    }
    doc.currentStep += 1;
    doc.assignedToId = nextAssigneeId;
    doc.status = DocumentStatus.PENDING;
    await this.docRepo.save(doc);
    await this.logApproval(docId, userId, ApprovalAction.SUBMIT, doc.currentStep, comment);
    await this.notifications.notify(nextAssigneeId, `Bạn có hồ sơ mới cần duyệt: "${doc.title}"`, doc.id);
    return doc;
  }

  // Người tạo bấm Hoàn thành → kết thúc + sinh PDF lịch sử phê duyệt
  async complete(tenantId: string, userId: string, docId: string) {
    const doc = await this.getOwned(tenantId, userId, docId);
    if (doc.status !== DocumentStatus.APPROVED) {
      throw new ForbiddenException('Chỉ hoàn thành khi hồ sơ đã được duyệt');
    }

    // Lấy lịch sử phê duyệt
    const approvals = await this.approvalRepo.find({
      where: { documentId: docId },
      relations: { actor: true },
      order: { createdAt: 'ASC' },
    });
    const history = approvals.map((a) => ({
      actorName: a.actor?.fullName || a.actor?.username || '',
      email: a.actor?.email || '',
      action: a.action,
      step: a.step,
      comment: a.comment,
      at: a.createdAt,
    }));

    // Lấy PDF tài liệu phê duyệt gốc (nếu có) để nối lịch sử vào cuối
    let basePdf: Buffer | undefined;
    const baseFile = await this.fileRepo.findOne({
      where: { documentId: docId },
      order: { createdAt: 'DESC' },
    });
    if (baseFile && baseFile.mimetype === 'application/pdf') {
      try { basePdf = await this.minio.getBuffer(baseFile.storageKey); } catch { /* bỏ qua */ }
    }

    // Sinh PDF + lưu MinIO + tạo bản ghi file
    const pdfBuffer = await this.approvalPdf.build(doc, history, basePdf);
    const storageKey = `${docId}/lich-su-phe-duyet-${uuid()}.pdf`;
    await this.minio.upload(storageKey, pdfBuffer, 'application/pdf');
    await this.fileRepo.save(this.fileRepo.create({
      documentId: docId, uploadedById: userId,
      filename: 'Lich-su-phe-duyet.pdf', mimetype: 'application/pdf',
      size: pdfBuffer.length, storageKey, version: 1,
      isApprovalDoc: false, note: 'PDF lịch sử phê duyệt (tự sinh khi hoàn thành)',
    }));

    doc.status = DocumentStatus.COMPLETED;
    doc.assignedToId = null as any;
    await this.docRepo.save(doc);
    await this.logApproval(docId, userId, ApprovalAction.COMPLETE, doc.currentStep, 'Hoàn thành hồ sơ');
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
