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
    // Hàng đợi người duyệt cấp 2..5: ưu tiên nextApproverIds; fallback secondApproverId (cũ)
    const queue = (dto.nextApproverIds ?? (dto.secondApproverId ? [dto.secondApproverId] : []))
      .filter(Boolean);

    // Số thứ tự chạy tăng trong tổ chức
    const seq = (await this.docRepo.count({ where: { tenantId } })) + 1;
    const code = this.genCode(dto.orgUnit, seq);

    const doc = this.docRepo.create({
      ...dto,
      tenantId,
      code,
      seq,
      createdById: userId,
      status: DocumentStatus.DRAFT,
      ccUserIds: dto.ccUserIds ?? [],
      approverQueue: queue,
    });
    return this.docRepo.save(doc);
  }

  // Mã hồ sơ: <Phòng ban>-<YYYYMMDD ngày tạo>-<STT 4 chữ số>. Vd: KT-20260619-0007
  private genCode(orgUnit: string | undefined, seq: number): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const ymd = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
    return `${this.deptCode(orgUnit)}-${ymd}-${String(seq).padStart(4, '0')}`;
  }

  // Viết tắt tên phòng ban: bỏ tiền tố (Phòng/Ban/Trung tâm/Bộ phận), lấy chữ cái đầu mỗi từ.
  // "Phòng Kế toán" -> "KT", "Phòng Kinh doanh" -> "KD", "Ban Nhân sự" -> "NS". Rỗng -> "HS".
  private deptCode(orgUnit?: string): string {
    if (!orgUnit) return 'HS';
    const cleaned = orgUnit
      .normalize('NFC')
      .replace(/\b(Phòng|Ban|Trung tâm|Bộ phận|Khối)\b/gi, '')
      .trim();
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (!words.length) return 'HS';
    // Bỏ dấu để lấy chữ cái đầu ASCII
    const noAccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd');
    const abbr = words.map((w) => noAccent(w).charAt(0).toUpperCase()).join('');
    return abbr || 'HS';
  }

  // Cập nhật hồ sơ nháp (chỉ chủ nhân, chỉ khi status=draft hoặc returned)
  async updateDraft(tenantId: string, userId: string, docId: string, dto: any) {
    const doc = await this.getOwned(tenantId, userId, docId);
    if (doc.status !== DocumentStatus.DRAFT && doc.status !== DocumentStatus.RETURNED) {
      throw new ForbiddenException('Chỉ được sửa hồ sơ ở trạng thái nháp hoặc bị trả về');
    }
    // Cho phép cập nhật các trường cơ bản + luồng phê duyệt (không đổi mã, người tạo, trạng thái)
    const allowed: (keyof typeof dto)[] = [
      'title', 'docType', 'priority', 'description', 'orgUnit', 'dueDate', 'workflowId',
      'assignedToId', 'secondApproverId', 'nextApproverIds', 'ccUserIds',
    ];
    for (const k of allowed) {
      if (dto[k] !== undefined) (doc as any)[k] = dto[k];
    }
    // Đồng bộ approverQueue nếu nextApproverIds được cập nhật
    if (dto.nextApproverIds !== undefined) {
      doc.approverQueue = (dto.nextApproverIds ?? []).filter(Boolean);
    }
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
        attachments: true, approvals: { actor: true }, createdBy: true,
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
  async search(tenantId: string, userId: string, dto: SearchDocumentDto, role?: string) {
    const page = Number(dto.page) || 1;
    const pageSize = Number(dto.pageSize) || 10;
    // Chỉ Giám đốc & Admin được xem toàn bộ hồ sơ; còn lại chỉ thấy hồ sơ liên quan tới mình
    const canSeeAll = role === 'director' || role === 'admin';

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
      // 'all' (Tìm hồ sơ): Giám đốc/Admin xem tất cả; người khác chỉ thấy hồ sơ liên quan tới mình
      default:
        if (!canSeeAll) {
          qb.andWhere(new Brackets((w) => {
            w.where('d.createdById = :uid', { uid: userId })          // mình trình
              .orWhere('d.assignedToId = :uid', { uid: userId })       // được giao xử lý
              .orWhere('d.ccUserIds @> :ccU', { ccU: JSON.stringify([userId]) }) // liên quan (CC)
              .orWhere('EXISTS (SELECT 1 FROM approvals a WHERE a."documentId" = d.id AND a."actorId" = :uid)', { uid: userId }); // đã thao tác
          }));
        }
        break;
    }

    if (dto.keyword) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('d.title ILIKE :kw', { kw: `%${dto.keyword}%` })
            .orWhere('d.description ILIKE :kw', { kw: `%${dto.keyword}%` })
            .orWhere('d.code ILIKE :kw', { kw: `%${dto.keyword}%` });
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

    // Tự động chuyển sang người duyệt cấp kế tiếp trong hàng đợi (cấp 2..5)
    if (!nextAssigneeId && doc.approverQueue?.length) {
      nextAssigneeId = doc.approverQueue[0];
      doc.approverQueue = doc.approverQueue.slice(1); // đã dùng, bỏ khỏi hàng đợi
    }
    // Tương thích hồ sơ cũ (tạo trước khi có hàng đợi)
    if (!nextAssigneeId && doc.secondApproverId) {
      nextAssigneeId = doc.secondApproverId;
      doc.secondApproverId = null as any;
    }

    if (nextAssigneeId) {
      // Chuyển tới người duyệt kế tiếp
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
      code: a.actor?.username || '',
      orgUnit: a.actor?.orgUnit || '',
      email: a.actor?.email || '',
      action: a.action,
      step: a.step,
      comment: a.comment,
      at: a.createdAt,
    }));

    // Chọn đúng PDF người gửi tải lên để nối thêm trang lịch sử (giữ nguyên mọi trang gốc).
    // Ưu tiên: tài liệu phê duyệt chính (isApprovalDoc), nếu không có thì PDF tải lên sớm nhất.
    const pdfFiles = await this.fileRepo.find({
      where: { documentId: docId, mimetype: 'application/pdf' },
      order: { createdAt: 'ASC' },
    });
    const baseFile = pdfFiles.find((f) => f.isApprovalDoc) || pdfFiles[0];

    let basePdf: Buffer | undefined;
    if (baseFile) {
      try { basePdf = await this.minio.getBuffer(baseFile.storageKey); } catch { /* bỏ qua */ }
    }

    // Nối trang lịch sử vào cuối PDF gốc (hoặc tạo PDF mới nếu không có file đính kèm PDF)
    const pdfBuffer = await this.approvalPdf.build(doc, history, basePdf);
    const storageKey = `${docId}/final-${uuid()}.pdf`;
    await this.minio.upload(storageKey, pdfBuffer, 'application/pdf');

    if (baseFile) {
      // Chỉ giữ 1 file: cập nhật chính file gốc trỏ sang bản đã nối lịch sử, xóa object cũ
      const oldKey = baseFile.storageKey;
      baseFile.storageKey = storageKey;
      baseFile.size = pdfBuffer.length;
      baseFile.isApprovalDoc = true;
      baseFile.note = 'Đã nối trang lịch sử phê duyệt';
      await this.fileRepo.save(baseFile);
      if (oldKey !== storageKey) { try { await this.minio.remove(oldKey); } catch { /* bỏ qua */ } }
    } else {
      // Không có PDF đính kèm → tạo 1 file lịch sử
      await this.fileRepo.save(this.fileRepo.create({
        documentId: docId, uploadedById: userId,
        filename: 'Lich-su-phe-duyet.pdf', mimetype: 'application/pdf',
        size: pdfBuffer.length, storageKey, version: 1,
        isApprovalDoc: true, note: 'PDF lịch sử phê duyệt',
      }));
    }

    doc.status = DocumentStatus.COMPLETED;
    doc.completedAt = new Date();
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
