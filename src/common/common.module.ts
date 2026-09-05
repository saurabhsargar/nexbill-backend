import { Module } from '@nestjs/common';
import { TaxCalcService } from './tax-calc/tax-calc.service';

@Module({
  providers: [TaxCalcService],
  exports: [TaxCalcService],
})
export class CommonModule {}
