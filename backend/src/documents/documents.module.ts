import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './document.entity';
import { DocumentFile } from './document-file.entity';
import { Approval } from './approval.entity';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Document, DocumentFile, Approval])],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [TypeOrmModule, DocumentsService],
})
export class DocumentsModule {}
