import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/database/prisma.module';
import { InvoiceConfigService } from './invoice-config.service';
import { RegionalSettingsService } from './regional-settings.service';
import { SettingsController } from './settings.controller';
import { TaxConfigService } from './tax-config.service';

@Module({
  imports: [PrismaModule],
  controllers: [SettingsController],
  providers: [TaxConfigService, InvoiceConfigService, RegionalSettingsService],
})
export class SettingsModule {}
