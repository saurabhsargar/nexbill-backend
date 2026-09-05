import { Injectable } from '@nestjs/common';
import { AuthUser } from 'src/auth/types/auth-user.type';
import { TaxCalcService } from 'src/common/tax-calc/tax-calc.service';
import { PrismaService } from 'src/database/prisma.service';

const SAMPLE_UNIT_PRICE = 1000;
const SAMPLE_QUANTITY = 1;

/**
 * Powers the Accounting page's live invoice preview using the same tax-calc
 * logic as real invoice creation (`InvoicesService.create`), so the two can
 * never disagree -- a fixed sample line, not a real invoice.
 */
@Injectable()
export class InvoicePreviewService {
  constructor(
    private prisma: PrismaService,
    private taxCalc: TaxCalcService,
  ) {}

  async get(user: AuthUser) {
    const taxConfig = await this.prisma.taxConfig.upsert({
      where: { organizationId: user.organizationId },
      update: {},
      create: { organizationId: user.organizationId },
    });

    const line = this.taxCalc.calcLine(
      {
        unitPrice: SAMPLE_UNIT_PRICE,
        quantity: SAMPLE_QUANTITY,
        gstRate: taxConfig.gstEnabled ? taxConfig.defaultGstRate : 0,
      },
      0,
    );

    const totalTax = Number(line.taxAmount);
    const half = Number((totalTax / 2).toFixed(2));

    return {
      sampleUnitPrice: SAMPLE_UNIT_PRICE,
      sampleQuantity: SAMPLE_QUANTITY,
      taxableValue: Number(line.taxableValue),
      cgstAmount: taxConfig.cgstEnabled ? half : 0,
      sgstAmount: taxConfig.sgstEnabled ? totalTax - half : 0,
      igstAmount: taxConfig.igstEnabled ? totalTax : 0,
      totalTax,
      total: Number(line.lineTotal),
    };
  }
}
