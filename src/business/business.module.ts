import { Module } from '@nestjs/common';
import { CommonModule } from 'src/common/common.module';
import { PrismaModule } from 'src/database/prisma.module';
import { BusinessProfileService } from './business-profile.service';
import { BusinessController } from './business.controller';
import { InvoicePreviewService } from './invoice-preview.service';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [BusinessController],
  providers: [BusinessProfileService, InvoicePreviewService],
})
export class BusinessModule {}
