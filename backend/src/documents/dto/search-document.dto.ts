import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { DocumentStatus, DocumentPriority } from '../document.entity';

export type DocBox = 'inbox' | 'outbox' | 'draft' | 'related' | 'all';

export class SearchDocumentDto {
  @IsOptional() @IsString()
  keyword?: string;

  @IsOptional() @IsEnum(DocumentPriority)
  priority?: DocumentPriority;

  @IsOptional() @IsString()
  docType?: string;

  @IsOptional() @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @IsOptional() @IsString()
  orgUnit?: string;

  @IsOptional() @IsString()
  workflowId?: string;

  @IsOptional() @IsDateString()
  fromDate?: string;

  @IsOptional() @IsDateString()
  toDate?: string;

  @IsOptional() @IsString()
  box?: DocBox;

  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;
}
