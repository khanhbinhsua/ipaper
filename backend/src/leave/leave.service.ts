import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveRequest, LeaveStatus } from './leave-request.entity';
import { CreateLeaveDto } from './dto/create-leave.dto';

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(LeaveRequest) private repo: Repository<LeaveRequest>,
  ) {}

  create(tenantId: string, userId: string, dto: CreateLeaveDto) {
    const entity = this.repo.create({
      tenantId, userId,
      leaveType: dto.leaveType,
      fromDate: dto.fromDate,
      toDate: dto.toDate,
      halfAm: dto.halfAm ?? false,
      halfPm: dto.halfPm ?? false,
      approvedById: dto.approverId, // người sẽ duyệt
      status: LeaveStatus.PENDING,
    });
    return this.repo.save(entity);
  }

  // Đơn của tôi (đã tạo)
  myRequests(tenantId: string, userId: string) {
    return this.repo.find({
      where: { tenantId, userId },
      relations: { approvedBy: true },
      order: { createdAt: 'DESC' },
    });
  }

  // Đơn chờ tôi duyệt
  pendingForApprover(tenantId: string, approverId: string) {
    return this.repo.find({
      where: { tenantId, approvedById: approverId, status: LeaveStatus.PENDING },
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
  }

  async approve(tenantId: string, approverId: string, id: string, comment?: string) {
    return this.decide(tenantId, approverId, id, LeaveStatus.APPROVED, comment);
  }

  async reject(tenantId: string, approverId: string, id: string, comment?: string) {
    return this.decide(tenantId, approverId, id, LeaveStatus.REJECTED, comment);
  }

  private async decide(tenantId: string, approverId: string, id: string, status: LeaveStatus, comment?: string) {
    const req = await this.repo.findOne({ where: { id, tenantId } });
    if (!req) throw new NotFoundException('Đơn nghỉ không tồn tại');
    if (req.approvedById !== approverId) {
      throw new ForbiddenException('Bạn không phải người duyệt đơn này');
    }
    req.status = status;
    req.approverComment = comment ?? null as any;
    return this.repo.save(req);
  }
}
