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

  // Người duyệt đầu tiên (chuyển tới)
  @IsOptional() @IsString()
  assignedToId?: string;

  // Người liên quan (CC)
  @IsOptional() @IsArray()
  ccUserIds?: string[];
}
