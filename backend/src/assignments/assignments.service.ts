import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, In } from 'typeorm';
import {
  Assignment, AssignmentType, AssignmentStatus, AssignmentPriority,
} from './assignment.entity';
import { User } from '../users/user.entity';
import { v4 as uuid } from 'uuid';
import { NotificationsService } from '../notifications/notifications.service';
import { MinioService } from '../files/minio.service';

interface CreateAssignmentDto {
  type: AssignmentType;
  title: string;
  description?: string;
  assigneeId?: string;
  assigneeIds?: string[];
  fromOrgUnit?: string;
  toOrgUnit?: string;
  toOrgUnits?: string[];
  priority?: AssignmentPriority;
  dueDate?: string;
}

interface UpdateStatusDto {
  status: AssignmentStatus;
  progressNote?: string;
}

interface SearchDto {
  type?: AssignmentType;
  box?: 'assigned' | 'received' | 'all'; // do tôi giao / tôi nhận / tất cả (giám đốc, admin)
  status?: AssignmentStatus;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(Assignment) private repo: Repository<Assignment>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private notifications: NotificationsService,
    private minio: MinioService,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateAssignmentDto) {
    const assigneeIds = dto.assigneeIds && dto.assigneeIds.length > 0
      ? dto.assigneeIds
      : (dto.assigneeId ? [dto.assigneeId] : []);

    if (assigneeIds.length === 0) throw new ForbiddenException('Cần chọn người nhận');
    if (assigneeIds.every((id) => id === userId)) throw new ForbiddenException('Không thể giao/gửi cho chính mình');

    const primaryAssigneeId = assigneeIds.find((id) => id !== userId) || assigneeIds[0];

    const toOrgUnits = dto.toOrgUnits && dto.toOrgUnits.length > 0
      ? dto.toOrgUnits
      : (dto.toOrgUnit ? [dto.toOrgUnit] : []);
    const primaryToOrgUnit = toOrgUnits[0] || dto.toOrgUnit || null;

    // Số thứ tự chạy theo tenant + type + ngày → mã dạng GV-YYYYMMDD-#### hoặc PH-YYYYMMDD-####
    const seq = (await this.repo.count({ where: { tenantId, type: dto.type } })) + 1;
    const prefix = dto.type === AssignmentType.TASK ? 'GV' : 'PH';
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const code = `${prefix}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${String(seq).padStart(4, '0')}`;

    const item = this.repo.create({
      type: dto.type,
      title: dto.title,
      description: dto.description,
      fromOrgUnit: dto.fromOrgUnit,
      code,
      tenantId,
      assignerId: userId,
      assigneeId: primaryAssigneeId,
      assigneeIds,
      toOrgUnit: primaryToOrgUnit ?? undefined,
      toOrgUnits,
      status: AssignmentStatus.PENDING,
      priority: dto.priority ?? AssignmentPriority.NORMAL,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    });
    const saved = await this.repo.save(item);

    // Thông báo cho tất cả người nhận
    const kind = dto.type === AssignmentType.TASK ? 'giao việc' : 'phối hợp';
    const notifyRecipients = assigneeIds.filter((id) => id !== userId);
    for (const recipientId of notifyRecipients) {
      await this.notifications.notify(
        recipientId,
        `Bạn có ${kind} mới: "${dto.title}" (${code})`,
        saved.id,
      );
    }
    return saved;
  }

  async findOne(tenantId: string, userId: string, role: string | undefined, id: string) {
    const item = await this.repo.findOne({
      where: { id, tenantId },
      relations: { assigner: true, assignee: true },
    });
    if (!item) throw new NotFoundException('Không tìm thấy');

    const canSeeAll = role === 'admin' || role === 'director';
    const isAssignee = item.assigneeId === userId || (Array.isArray(item.assigneeIds) && item.assigneeIds.includes(userId));
    if (!canSeeAll && item.assignerId !== userId && !isAssignee) {
      throw new ForbiddenException('Không có quyền xem');
    }

    let assignees: User[] = [];
    if (Array.isArray(item.assigneeIds) && item.assigneeIds.length > 0) {
      assignees = await this.userRepo.findBy({ id: In(item.assigneeIds) });
    } else if (item.assignee) {
      assignees = [item.assignee];
    }

    return { ...item, assignees };
  }

  async search(tenantId: string, userId: string, role: string | undefined, dto: SearchDto) {
    const page = Number(dto.page) || 1;
    const pageSize = Number(dto.pageSize) || 15;
    const qb = this.repo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.assigner', 'assigner')
      .leftJoinAndSelect('a.assignee', 'assignee')
      .where('a.tenantId = :tenantId', { tenantId });

    if (dto.type) qb.andWhere('a.type = :type', { type: dto.type });
    if (dto.status) qb.andWhere('a.status = :status', { status: dto.status });

    const uidJson = JSON.stringify([userId]);
    const canSeeAll = role === 'admin' || role === 'director';

    switch (dto.box) {
      case 'assigned':
        qb.andWhere('a.assignerId = :uid', { uid: userId });
        break;
      case 'received':
        qb.andWhere(new Brackets((w) => {
          w.where('a.assigneeId = :uid', { uid: userId })
            .orWhere('a.assigneeIds::jsonb @> :uidJson::jsonb', { uidJson });
        }));
        break;
      case 'all':
        if (!canSeeAll) {
          qb.andWhere(new Brackets((w) => {
            w.where('a.assignerId = :uid', { uid: userId })
              .orWhere('a.assigneeId = :uid', { uid: userId })
              .orWhere('a.assigneeIds::jsonb @> :uidJson::jsonb', { uidJson });
          }));
        }
        break;
      default:
        // mặc định: chỉ hiện liên quan tới người dùng (giao hoặc nhận)
        qb.andWhere(new Brackets((w) => {
          w.where('a.assignerId = :uid', { uid: userId })
            .orWhere('a.assigneeId = :uid', { uid: userId })
            .orWhere('a.assigneeIds::jsonb @> :uidJson::jsonb', { uidJson });
        }));
    }

    if (dto.keyword) {
      qb.andWhere(new Brackets((w) => {
        w.where('a.title ILIKE :kw', { kw: `%${dto.keyword}%` })
          .orWhere('a.description ILIKE :kw', { kw: `%${dto.keyword}%` })
          .orWhere('a.code ILIKE :kw', { kw: `%${dto.keyword}%` });
      }));
    }

    qb.orderBy('a.createdAt', 'DESC').skip((page - 1) * pageSize).take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async updateStatus(tenantId: string, userId: string, id: string, dto: UpdateStatusDto) {
    const item = await this.repo.findOne({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Không tìm thấy');

    const isAssignee = item.assigneeId === userId || (Array.isArray(item.assigneeIds) && item.assigneeIds.includes(userId));
    if (!isAssignee && item.assignerId !== userId) {
      throw new ForbiddenException('Không có quyền cập nhật');
    }
    item.status = dto.status;
    if (dto.progressNote !== undefined) item.progressNote = dto.progressNote;
    if (dto.status === AssignmentStatus.DONE) item.completedAt = new Date();

    await this.repo.save(item);

    // Thông báo cho người giao và tất cả người nhận (ngoại trừ người vừa cập nhật)
    const recipients = new Set([item.assignerId, item.assigneeId, ...(item.assigneeIds ?? [])]);
    recipients.delete(userId);
    const statusLabel = {
      pending: 'Chưa xử lý', in_progress: 'Đang thực hiện', done: 'Hoàn thành', cancelled: 'Đã huỷ',
    }[dto.status] || dto.status;

    for (const rId of recipients) {
      if (rId) await this.notifications.notify(rId, `"${item.title}" — ${statusLabel}`, item.id);
    }

    return item;
  }

  async remove(tenantId: string, userId: string, id: string) {
    const item = await this.repo.findOne({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Không tìm thấy');
    // Chỉ người giao mới xoá được
    if (item.assignerId !== userId) throw new ForbiddenException('Chỉ người giao mới xoá được');
    // Xoá file đính kèm trên MinIO
    for (const f of item.attachments ?? []) {
      try { await this.minio.remove(f.key); } catch { /* ignore */ }
    }
    await this.repo.remove(item);
    return { message: 'Đã xoá' };
  }

  // === File đính kèm ===
  // Người giao HOẶC người nhận đều có thể upload
  async addFile(tenantId: string, userId: string, id: string, file: Express.Multer.File) {
    const item = await this.repo.findOne({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Không tìm thấy');
    const isAssignee = item.assigneeId === userId || (Array.isArray(item.assigneeIds) && item.assigneeIds.includes(userId));
    if (item.assignerId !== userId && !isAssignee) {
      throw new ForbiddenException('Không có quyền đính kèm file');
    }
    // Multer decode filename latin1 → utf8 cho đúng tiếng Việt
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const key = `assignments/${id}/${uuid()}-${originalName}`;
    await this.minio.upload(key, file.buffer, file.mimetype);
    item.attachments = [
      ...(item.attachments ?? []),
      { key, originalName, size: file.size, mimeType: file.mimetype, uploadedAt: new Date().toISOString() },
    ];
    return this.repo.save(item);
  }

  async removeFile(tenantId: string, userId: string, id: string, key: string) {
    const item = await this.repo.findOne({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Không tìm thấy');
    const isAssignee = item.assigneeId === userId || (Array.isArray(item.assigneeIds) && item.assigneeIds.includes(userId));
    if (item.assignerId !== userId && !isAssignee) {
      throw new ForbiddenException('Không có quyền xoá file');
    }
    item.attachments = (item.attachments ?? []).filter((f) => f.key !== key);
    try { await this.minio.remove(key); } catch { /* ignore */ }
    return this.repo.save(item);
  }

  async fileDownloadUrl(
    tenantId: string, userId: string, role: string | undefined, id: string, key: string,
    disposition: 'attachment' | 'inline' = 'attachment',
  ) {
    const item = await this.repo.findOne({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Không tìm thấy');
    const canSeeAll = role === 'admin' || role === 'director';
    const isAssignee = item.assigneeId === userId || (Array.isArray(item.assigneeIds) && item.assigneeIds.includes(userId));
    if (!canSeeAll && item.assignerId !== userId && !isAssignee) {
      throw new ForbiddenException('Không có quyền tải file');
    }
    const file = (item.attachments ?? []).find((f) => f.key === key);
    if (!file) throw new NotFoundException('File không tồn tại');
    const filename = encodeURIComponent(file.originalName);
    // disposition=inline → trình duyệt hiển thị trực tiếp (ảnh/PDF); attachment → tải về
    const url = await this.minio.presignedUrl(key, 3600, {
      'response-content-disposition': `${disposition}; filename*=UTF-8''${filename}`,
    });
    return { url };
  }
}
