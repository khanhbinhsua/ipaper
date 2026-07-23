import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import {
  Assignment, AssignmentType, AssignmentStatus, AssignmentPriority,
} from './assignment.entity';
import { NotificationsService } from '../notifications/notifications.service';

interface CreateAssignmentDto {
  type: AssignmentType;
  title: string;
  description?: string;
  assigneeId: string;
  fromOrgUnit?: string;
  toOrgUnit?: string;
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
    private notifications: NotificationsService,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateAssignmentDto) {
    if (!dto.assigneeId) throw new ForbiddenException('Cần chọn người nhận');
    if (dto.assigneeId === userId) throw new ForbiddenException('Không thể giao/gửi cho chính mình');

    // Số thứ tự chạy theo tenant + type + ngày → mã dạng GV-YYYYMMDD-#### hoặc PH-YYYYMMDD-####
    const seq = (await this.repo.count({ where: { tenantId, type: dto.type } })) + 1;
    const prefix = dto.type === AssignmentType.TASK ? 'GV' : 'PH';
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const code = `${prefix}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${String(seq).padStart(4, '0')}`;

    const item = this.repo.create({
      ...dto,
      code,
      tenantId,
      assignerId: userId,
      status: AssignmentStatus.PENDING,
      priority: dto.priority ?? AssignmentPriority.NORMAL,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null as any,
    });
    const saved = await this.repo.save(item);

    // Thông báo cho người nhận
    const kind = dto.type === AssignmentType.TASK ? 'giao việc' : 'phối hợp';
    await this.notifications.notify(
      dto.assigneeId,
      `Bạn có ${kind} mới: "${dto.title}" (${code})`,
      saved.id,
    );
    return saved;
  }

  async findOne(tenantId: string, userId: string, role: string | undefined, id: string) {
    const item = await this.repo.findOne({
      where: { id, tenantId },
      relations: { assigner: true, assignee: true },
    });
    if (!item) throw new NotFoundException('Không tìm thấy');
    // Quyền xem: người giao, người nhận, hoặc admin/director
    const canSeeAll = role === 'admin' || role === 'director';
    if (!canSeeAll && item.assignerId !== userId && item.assigneeId !== userId) {
      throw new ForbiddenException('Không có quyền xem');
    }
    return item;
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

    const canSeeAll = role === 'admin' || role === 'director';
    switch (dto.box) {
      case 'assigned':
        qb.andWhere('a.assignerId = :uid', { uid: userId });
        break;
      case 'received':
        qb.andWhere('a.assigneeId = :uid', { uid: userId });
        break;
      case 'all':
        if (!canSeeAll) {
          qb.andWhere(new Brackets((w) => {
            w.where('a.assignerId = :uid', { uid: userId })
              .orWhere('a.assigneeId = :uid', { uid: userId });
          }));
        }
        break;
      default:
        // mặc định: chỉ hiện liên quan tới người dùng (giao hoặc nhận)
        qb.andWhere(new Brackets((w) => {
          w.where('a.assignerId = :uid', { uid: userId })
            .orWhere('a.assigneeId = :uid', { uid: userId });
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
    // Chỉ người nhận (hoặc người giao) được cập nhật trạng thái
    if (item.assigneeId !== userId && item.assignerId !== userId) {
      throw new ForbiddenException('Không có quyền cập nhật');
    }
    item.status = dto.status;
    if (dto.progressNote !== undefined) item.progressNote = dto.progressNote;
    if (dto.status === AssignmentStatus.DONE) item.completedAt = new Date();

    await this.repo.save(item);

    // Thông báo cho phía còn lại
    const other = userId === item.assigneeId ? item.assignerId : item.assigneeId;
    const statusLabel = {
      pending: 'Chưa xử lý', in_progress: 'Đang thực hiện', done: 'Đã hoàn thành', cancelled: 'Đã huỷ',
    }[dto.status] || dto.status;
    await this.notifications.notify(other, `"${item.title}" — ${statusLabel}`, item.id);

    return item;
  }

  async remove(tenantId: string, userId: string, id: string) {
    const item = await this.repo.findOne({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Không tìm thấy');
    // Chỉ người giao mới xoá được
    if (item.assignerId !== userId) throw new ForbiddenException('Chỉ người giao mới xoá được');
    await this.repo.remove(item);
    return { message: 'Đã xoá' };
  }
}
