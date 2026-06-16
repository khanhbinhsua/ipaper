import { IsString, IsDateString, IsOptional, IsBoolean } from 'class-validator';

export class CreateLeaveDto {
  @IsString()
  leaveType: string;

  @IsDateString()
  fromDate: string;

  @IsDateString()
  toDate: string;

  @IsOptional() @IsBoolean()
  halfAm?: boolean;

  @IsOptional() @IsBoolean()
  halfPm?: boolean;

  // Người duyệt (cấp quản lý)
  @IsString()
  approverId: string;
}
