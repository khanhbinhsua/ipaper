import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './document.entity';
import { DocumentFile } from './document-file.entity';
import { Approval } from './approval.entity';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { ApprovalPdfService } from './approval-pdf.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentFile, Approval]),
    NotificationsModule,
    FilesModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, ApprovalPdfService],
  exports: [TypeOrmModule, DocumentsService],
})
export class DocumentsModule {}
