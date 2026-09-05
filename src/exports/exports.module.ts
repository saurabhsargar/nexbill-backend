import { Module } from '@nestjs/common';
import { ProductsModule } from 'src/products/products.module';
import { ReportsModule } from 'src/reports/reports.module';
import { ExportsController } from './exports.controller';

@Module({
  imports: [ProductsModule, ReportsModule],
  controllers: [ExportsController],
})
export class ExportsModule {}
