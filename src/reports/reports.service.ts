import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { stringify } from 'csv-stringify/sync';
import { Workbook } from 'exceljs';
import { Response } from 'express';
import PDFDocument from 'pdfkit';
import { AuthUser } from 'src/auth/types/auth-user.type';
import { buildDateRangeFilter } from 'src/common/date/date-range.util';
import {
  buildTrendWindow,
  TrendRange,
} from 'src/common/date/trend-window.util';
import { pctChange } from 'src/common/percent-change.util';
import { PrismaService } from 'src/database/prisma.service';
import { renderGstReportPdf } from './gst-pdf.util';

const { Decimal } = Prisma;

type InvoiceRow = {
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  total: Prisma.Decimal;
};

const revenueOf = (rows: InvoiceRow[]) =>
  rows.reduce(
    (sum, i) => sum.add(i.subtotal).sub(i.discountAmount),
    new Decimal(0),
  );
const totalOf = (rows: InvoiceRow[]) =>
  rows.reduce((sum, i) => sum.add(i.total), new Decimal(0));

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async summaryStats(user: AuthUser, range: TrendRange) {
    const window = buildTrendWindow(range);
    const now = new Date();
    const duration = now.getTime() - window.start.getTime();
    const previousStart = new Date(window.start.getTime() - duration);
    const organizationId = user.organizationId;

    const [
      currentInvoices,
      previousInvoices,
      currentCustomers,
      previousCustomers,
    ] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { organizationId, createdAt: { gte: window.start, lte: now } },
      }),
      this.prisma.invoice.findMany({
        where: {
          organizationId,
          createdAt: { gte: previousStart, lt: window.start },
        },
      }),
      this.prisma.customer.count({
        where: { organizationId, createdAt: { gte: window.start, lte: now } },
      }),
      this.prisma.customer.count({
        where: {
          organizationId,
          createdAt: { gte: previousStart, lt: window.start },
        },
      }),
    ]);

    const currentRevenue = revenueOf(currentInvoices);
    const previousRevenue = revenueOf(previousInvoices);
    const currentOrders = currentInvoices.length;
    const previousOrders = previousInvoices.length;
    const currentAov = currentOrders
      ? totalOf(currentInvoices).div(currentOrders)
      : new Decimal(0);
    const previousAov = previousOrders
      ? totalOf(previousInvoices).div(previousOrders)
      : new Decimal(0);

    return {
      totalRevenue: Number(currentRevenue),
      totalRevenueChangePercent: pctChange(
        Number(currentRevenue),
        Number(previousRevenue),
      ),
      totalOrders: currentOrders,
      totalOrdersChangePercent: pctChange(currentOrders, previousOrders),
      avgOrderValue: Number(currentAov),
      avgOrderValueChangePercent: pctChange(
        Number(currentAov),
        Number(previousAov),
      ),
      newCustomers: currentCustomers,
      newCustomersChangePercent: pctChange(currentCustomers, previousCustomers),
    };
  }

  async revenueExpenses(user: AuthUser, range: TrendRange) {
    const window = buildTrendWindow(range);
    const organizationId = user.organizationId;

    const [invoices, expenses] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { organizationId, createdAt: { gte: window.start } },
        select: { createdAt: true, subtotal: true, discountAmount: true },
      }),
      this.prisma.expense.findMany({
        where: { organizationId, incurredAt: { gte: window.start } },
        select: { incurredAt: true, amount: true },
      }),
    ]);

    const revenueByPeriod = new Map(
      window.keys.map((k) => [k, new Decimal(0)]),
    );
    for (const invoice of invoices) {
      const key = window.keyFor(invoice.createdAt);
      if (revenueByPeriod.has(key)) {
        revenueByPeriod.set(
          key,
          revenueByPeriod
            .get(key)!
            .add(invoice.subtotal)
            .sub(invoice.discountAmount),
        );
      }
    }

    const expensesByPeriod = new Map(
      window.keys.map((k) => [k, new Decimal(0)]),
    );
    for (const expense of expenses) {
      const key = window.keyFor(expense.incurredAt);
      if (expensesByPeriod.has(key)) {
        expensesByPeriod.set(
          key,
          expensesByPeriod.get(key)!.add(expense.amount),
        );
      }
    }

    return window.keys.map((period) => ({
      period,
      revenue: Number(revenueByPeriod.get(period)),
      expenses: Number(expensesByPeriod.get(period)),
    }));
  }

  async salesByCategory(user: AuthUser, from?: string, to?: string) {
    const createdAt = buildDateRangeFilter(from, to);
    const groups = await this.prisma.invoiceItem.groupBy({
      by: ['category'],
      where: {
        invoice: {
          organizationId: user.organizationId,
          ...(createdAt ? { createdAt } : {}),
        },
      },
      _sum: { lineTotal: true },
    });

    return groups.map((g) => ({
      category: g.category,
      sales: Number(g._sum.lineTotal ?? 0),
    }));
  }

  async gstSummary(user: AuthUser, from?: string, to?: string) {
    const createdAt = buildDateRangeFilter(from, to);
    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId: user.organizationId,
        ...(createdAt ? { createdAt } : {}),
      },
      select: { subtotal: true, discountAmount: true, taxAmount: true },
    });

    const grossSales = invoices.reduce(
      (s, i) => s.add(i.subtotal),
      new Decimal(0),
    );
    const discountTotal = invoices.reduce(
      (s, i) => s.add(i.discountAmount),
      new Decimal(0),
    );
    const gstCollected = invoices.reduce(
      (s, i) => s.add(i.taxAmount),
      new Decimal(0),
    );
    const netSales = grossSales.sub(discountTotal);

    // No refund/void or purchase-invoice model exists in this schema, so returns
    // and input tax credit can't be computed honestly yet -- reported as 0, not faked.
    const returns = new Decimal(0);
    const inputTaxCredit = new Decimal(0);
    const netGstPayable = gstCollected.sub(inputTaxCredit);

    return {
      grossSales: Number(grossSales),
      returns: Number(returns),
      netSales: Number(netSales),
      gstCollected: Number(gstCollected),
      inputTaxCredit: Number(inputTaxCredit),
      netGstPayable: Number(netGstPayable),
    };
  }

  private async invoiceExportRows(user: AuthUser, from?: string, to?: string) {
    const createdAt = buildDateRangeFilter(from, to);
    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId: user.organizationId,
        ...(createdAt ? { createdAt } : {}),
      },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return invoices.map((invoice) => ({
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.createdAt.toISOString().slice(0, 10),
      customer: invoice.customer?.name ?? 'Walk-in',
      subtotal: invoice.subtotal.toString(),
      discountAmount: invoice.discountAmount.toString(),
      taxAmount: invoice.taxAmount.toString(),
      total: invoice.total.toString(),
      paymentMethod: invoice.paymentMethod,
    }));
  }

  async exportReportCsv(
    user: AuthUser,
    from?: string,
    to?: string,
  ): Promise<string> {
    const rows = await this.invoiceExportRows(user, from, to);
    return stringify(rows, { header: true });
  }

  async exportReportXlsx(
    user: AuthUser,
    from?: string,
    to?: string,
  ): Promise<Buffer> {
    const rows = await this.invoiceExportRows(user, from, to);
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Invoices');
    sheet.columns = [
      { header: 'Invoice #', key: 'invoiceNumber', width: 16 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Customer', key: 'customer', width: 24 },
      { header: 'Subtotal', key: 'subtotal', width: 14 },
      { header: 'Discount', key: 'discountAmount', width: 14 },
      { header: 'Tax', key: 'taxAmount', width: 14 },
      { header: 'Total', key: 'total', width: 14 },
      { header: 'Payment Method', key: 'paymentMethod', width: 16 },
    ];
    sheet.addRows(rows);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async generateGstPdf(
    user: AuthUser,
    from: string | undefined,
    to: string | undefined,
    res: Response,
  ) {
    const [summary, organization] = await Promise.all([
      this.gstSummary(user, from, to),
      this.prisma.organization.findUniqueOrThrow({
        where: { id: user.organizationId },
      }),
    ]);

    res.header('Content-Type', 'application/pdf');
    res.attachment('gst-report.pdf');

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);
    renderGstReportPdf(doc, summary, organization.name, from, to);
    doc.end();
  }
}
