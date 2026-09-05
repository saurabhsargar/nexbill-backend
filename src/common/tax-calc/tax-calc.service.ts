import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

export interface LineTaxInput {
  unitPrice: Decimal | number | string;
  quantity: number;
  gstRate: Decimal | number | string;
}

export interface LineTaxResult {
  lineSubtotal: Decimal;
  discountAmount: Decimal;
  taxableValue: Decimal;
  taxRate: Decimal;
  taxAmount: Decimal;
  lineTotal: Decimal;
}

export interface InvoiceTotals {
  subtotal: Decimal;
  discountAmount: Decimal;
  taxAmount: Decimal;
  total: Decimal;
}

const round2 = (value: Decimal) => value.toDecimalPlaces(2);

/**
 * Single source of truth for invoice tax math, shared by invoice creation
 * and (later) the accounting live-preview endpoint, so the two can never disagree.
 *
 * GST is charged on the discounted (post-discount) taxable value per line,
 * which keeps per-product GST rates correct once a discount is applied.
 */
@Injectable()
export class TaxCalcService {
  calcLine(
    input: LineTaxInput,
    discountPercent: Decimal | number | string,
  ): LineTaxResult {
    const unitPrice = new Decimal(input.unitPrice);
    const gstRate = new Decimal(input.gstRate);
    const discount = new Decimal(discountPercent);

    const lineSubtotal = unitPrice.mul(input.quantity);
    const discountAmount = lineSubtotal.mul(discount).div(100);
    const taxableValue = lineSubtotal.sub(discountAmount);
    const taxAmount = taxableValue.mul(gstRate).div(100);
    const lineTotal = taxableValue.add(taxAmount);

    return {
      lineSubtotal: round2(lineSubtotal),
      discountAmount: round2(discountAmount),
      taxableValue: round2(taxableValue),
      taxRate: gstRate,
      taxAmount: round2(taxAmount),
      lineTotal: round2(lineTotal),
    };
  }

  calcInvoiceTotals(lines: LineTaxResult[]): InvoiceTotals {
    const zero = new Decimal(0);
    return {
      subtotal: lines.reduce((sum, l) => sum.add(l.lineSubtotal), zero),
      discountAmount: lines.reduce((sum, l) => sum.add(l.discountAmount), zero),
      taxAmount: lines.reduce((sum, l) => sum.add(l.taxAmount), zero),
      total: lines.reduce((sum, l) => sum.add(l.lineTotal), zero),
    };
  }
}
