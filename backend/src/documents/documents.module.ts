import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './document.entity';
import { DocumentFile } from './document-file.entity';
import { Approval } from './approval.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Document, DocumentFile, Approval])],
  exports: [TypeOrmModule],
})
export class DocumentsModule {}
