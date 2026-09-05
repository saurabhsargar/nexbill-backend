import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from 'src/auth/types/auth-user.type';
import {
  buildTrendWindow,
  TrendRange,
} from 'src/common/date/trend-window.util';
import { pctChange } from 'src/common/percent-change.util';
import { PrismaService } from 'src/database/prisma.service';

const { Decimal } = Prisma;

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(user: AuthUser) {
    const todayStart = startOfUtcDay(new Date());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

    const organizationId = user.organizationId;

    const [invoices, expenses, lowStock] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          organizationId,
          createdAt: { gte: yesterdayStart, lt: tomorrowStart },
        },
        include: { items: { select: { unitCost: true, quantity: true } } },
      }),
      this.prisma.expense.findMany({
        where: {
          organizationId,
          incurredAt: { gte: yesterdayStart, lt: tomorrowStart },
        },
      }),
      this.computeLowStock(organizationId, todayStart),
    ]);

    const todaysInvoices = invoices.filter((i) => i.createdAt >= todayStart);
    const yesterdaysInvoices = invoices.filter((i) => i.createdAt < todayStart);
    const todaysExpenses = expenses.filter((e) => e.incurredAt >= todayStart);
    const yesterdaysExpenses = expenses.filter(
      (e) => e.incurredAt < todayStart,
    );

    const salesOf = (rows: typeof invoices) =>
      rows.reduce((sum, i) => sum.add(i.total), new Decimal(0));
    const revenueOf = (rows: typeof invoices) =>
      rows.reduce(
        (sum, i) => sum.add(i.subtotal).sub(i.discountAmount),
        new Decimal(0),
      );
    const cogsOf = (rows: typeof invoices) =>
      rows.reduce(
        (sum, i) =>
          sum.add(
            i.items.reduce(
              (s, item) => s.add(item.unitCost.mul(item.quantity)),
              new Decimal(0),
            ),
          ),
        new Decimal(0),
      );
    const expensesOf = (rows: typeof expenses) =>
      rows.reduce((sum, e) => sum.add(e.amount), new Decimal(0));

    const todaysSales = salesOf(todaysInvoices);
    const yesterdaysSales = salesOf(yesterdaysInvoices);

    const todaysExpensesTotal = expensesOf(todaysExpenses);
    const yesterdaysExpensesTotal = expensesOf(yesterdaysExpenses);

    const todaysNetProfit = revenueOf(todaysInvoices)
      .sub(cogsOf(todaysInvoices))
      .sub(todaysExpensesTotal);
    const yesterdaysNetProfit = revenueOf(yesterdaysInvoices)
      .sub(cogsOf(yesterdaysInvoices))
      .sub(yesterdaysExpensesTotal);

    return {
      todaysSales: Number(todaysSales),
      todaysSalesChangePercent: pctChange(
        Number(todaysSales),
        Number(yesterdaysSales),
      ),
      netProfit: Number(todaysNetProfit),
      netProfitChangePercent: pctChange(
        Number(todaysNetProfit),
        Number(yesterdaysNetProfit),
      ),
      expenses: Number(todaysExpensesTotal),
      expensesChangePercent: pctChange(
        Number(todaysExpensesTotal),
        Number(yesterdaysExpensesTotal),
      ),
      lowStockCount: lowStock.lowStockCount,
      lowStockDelta: lowStock.lowStockDelta,
    };
  }

  /**
   * Reconstructs yesterday's end-of-day stock per product from today's known
   * mutations (sales + audited stock adjustments) rather than a dedicated
   * stock-history table. Direct `PATCH /products/:id` stock edits bypass the
   * audit trail and aren't reflected -- an accepted gap for that rare admin path.
   */
  private async computeLowStock(organizationId: string, todayStart: Date) {
    const products = await this.prisma.product.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, stock: true, minStock: true },
    });
    const productIds = products.map((p) => p.id);

    const [soldToday, adjustedToday] = await Promise.all([
      this.prisma.invoiceItem.groupBy({
        by: ['productId'],
        where: {
          productId: { in: productIds },
          invoice: { createdAt: { gte: todayStart } },
        },
        _sum: { quantity: true },
      }),
      this.prisma.stockAdjustment.groupBy({
        by: ['productId'],
        where: {
          productId: { in: productIds },
          createdAt: { gte: todayStart },
        },
        _sum: { delta: true },
      }),
    ]);

    const soldMap = new Map(
      soldToday.map((r) => [r.productId, r._sum.quantity ?? 0]),
    );
    const adjMap = new Map(
      adjustedToday.map((r) => [r.productId, r._sum.delta ?? 0]),
    );

    let yesterdayLowCount = 0;
    let todayLowCount = 0;
    for (const p of products) {
      if (p.stock <= p.minStock) todayLowCount++;
      const yesterdayStock =
        p.stock + (soldMap.get(p.id) ?? 0) - (adjMap.get(p.id) ?? 0);
      if (yesterdayStock <= p.minStock) yesterdayLowCount++;
    }

    return {
      lowStockCount: todayLowCount,
      lowStockDelta: todayLowCount - yesterdayLowCount,
    };
  }

  async getSalesTrend(user: AuthUser, range: TrendRange) {
    const window = buildTrendWindow(range);
    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId: user.organizationId,
        createdAt: { gte: window.start },
      },
      select: { createdAt: true, total: true },
    });

    const totals = new Map(window.keys.map((k) => [k, new Decimal(0)]));
    for (const invoice of invoices) {
      const key = window.keyFor(invoice.createdAt);
      if (totals.has(key)) totals.set(key, totals.get(key)!.add(invoice.total));
    }

    return window.keys.map((period) => ({
      period,
      sales: Number(totals.get(period)),
    }));
  }

  async getSalesByCategory(user: AuthUser, range: TrendRange) {
    const window = buildTrendWindow(range);
    const groups = await this.prisma.invoiceItem.groupBy({
      by: ['category'],
      where: {
        invoice: {
          organizationId: user.organizationId,
          createdAt: { gte: window.start },
        },
      },
      _sum: { lineTotal: true },
    });

    const total = groups.reduce(
      (sum, g) => sum.add(g._sum.lineTotal ?? 0),
      new Decimal(0),
    );
    return groups.map((g) => ({
      category: g.category,
      sharePercent: total.isZero()
        ? 0
        : Number(
            new Decimal(g._sum.lineTotal ?? 0)
              .div(total)
              .mul(100)
              .toDecimalPlaces(2),
          ),
    }));
  }

  async getRecentTransactions(user: AuthUser, limit: number) {
    const invoices = await this.prisma.invoice.findMany({
      where: { organizationId: user.organizationId },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customer?.name ?? 'Walk-in',
      amount: Number(invoice.total),
      paymentMethod: invoice.paymentMethod,
      status: 'PAID' as const,
      createdAt: invoice.createdAt,
    }));
  }

  async getTopProducts(user: AuthUser, range: TrendRange, limit: number) {
    const window = buildTrendWindow(range);
    const groups = await this.prisma.invoiceItem.groupBy({
      by: ['productId', 'productName'],
      where: {
        invoice: {
          organizationId: user.organizationId,
          createdAt: { gte: window.start },
        },
      },
      _sum: { quantity: true, lineTotal: true },
    });

    return groups
      .map((g) => ({
        productId: g.productId,
        name: g.productName,
        unitsSold: g._sum.quantity ?? 0,
        revenue: Number(g._sum.lineTotal ?? 0),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }
}
