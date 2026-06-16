import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Template } from './template.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Template])],
})
export class TemplatesModule {}
