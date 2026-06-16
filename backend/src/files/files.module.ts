import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentFile } from '../documents/document-file.entity';
import { MinioService } from './minio.service';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentFile])],
  controllers: [FilesController],
  providers: [MinioService, FilesService],
  exports: [MinioService, FilesService],
})
export class FilesModule {}
