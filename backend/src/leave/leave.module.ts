import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveRequest } from './leave-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LeaveRequest])],
})
export class LeaveModule {}
