import { IsString, IsOptional, IsEnum, IsArray, IsDateString } from 'class-validator';
import { DocumentPriority } from '../document.entity';

export class CreateDocumentDto {
  @IsString()
  title: string;

  @IsOptional() @IsString()
  docType?: string;

  @IsOptional() @IsEnum(DocumentPriority)
  priority?: DocumentPriority;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  orgUnit?: string;

  @IsOptional() @IsDateString()
  dueDate?: string;

  @IsOptional() @IsString()
  workflowId?: string;

  // Người duyệt cấp 1 (chuyển tới)
  @IsOptional() @IsString()
  assignedToId?: string;

  // Người duyệt cấp 2 (tự chuyển tới sau khi cấp 1 duyệt)
  @IsOptional() @IsString()
  secondApproverId?: string;

  // Người liên quan (CC)
  @IsOptional() @IsArray()
  ccUserIds?: string[];
}
