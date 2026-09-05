import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { AuthUser } from 'src/auth/types/auth-user.type';
import { PaginatedResult } from 'src/common/pagination/paginated-result.interface';
import { TaxCalcService } from 'src/common/tax-calc/tax-calc.service';
import { PrismaService } from 'src/database/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { renderInvoicePdf } from './invoice-pdf.util';

const INVOICE_INCLUDE = {
  items: true,
  customer: true,
} satisfies Prisma.InvoiceInclude;

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private taxCalc: TaxCalcService,
  ) {}

  async create(user: AuthUser, dto: CreateInvoiceDto) {
    const discountPercent = dto.discountPercent ?? 0;

    return this.prisma.$transaction(async (tx) => {
      if (dto.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: dto.customerId, organizationId: user.organizationId },
          select: { id: true },
        });
        if (!customer) throw new NotFoundException('Customer not found');
      }

      // Merge duplicate productId entries so stock/price are validated once per product.
      const quantities = new Map<string, number>();
      for (const item of dto.items) {
        quantities.set(
          item.productId,
          (quantities.get(item.productId) ?? 0) + item.quantity,
        );
      }
      const productIds = [...quantities.keys()];

      // Never trust client-sent price/name -- re-fetch from the DB, scoped to this org.
      const products = await tx.product.findMany({
        where: {
          id: { in: productIds },
          organizationId: user.organizationId,
          isActive: true,
        },
      });
      if (products.length !== productIds.length) {
        throw new NotFoundException('One or more products were not found');
      }

      const lines = products.map((product) => {
        const quantity = quantities.get(product.id)!;
        const calc = this.taxCalc.calcLine(
          { unitPrice: product.price, quantity, gstRate: product.gstRate },
          discountPercent,
        );
        return { product, quantity, calc };
      });
      const totals = this.taxCalc.calcInvoiceTotals(lines.map((l) => l.calc));

      // Atomic per-org invoice numbering: assigned number is the pre-increment value.
      const config = await tx.invoiceConfig.upsert({
        where: { organizationId: user.organizationId },
        update: { nextNumber: { increment: 1 } },
        create: { organizationId: user.organizationId, nextNumber: 1002 },
      });
      const invoiceNumber = `${config.prefix}${config.nextNumber - 1}`;

      // Concurrency-safe stock decrement: only succeeds if stock is still sufficient
      // at write time, guarding against two simultaneous invoices over-selling.
      for (const { product, quantity } of lines) {
        const result = await tx.product.updateMany({
          where: { id: product.id, stock: { gte: quantity } },
          data: { stock: { decrement: quantity } },
        });
        if (result.count === 0) {
          throw new BadRequestException(
            `Insufficient stock for ${product.name}`,
          );
        }
      }

      return tx.invoice.create({
        data: {
          invoiceNumber,
          subtotal: totals.subtotal,
          discountPercent,
          discountAmount: totals.discountAmount,
          taxAmount: totals.taxAmount,
          total: totals.total,
          paymentMethod: dto.paymentMethod,
          organizationId: user.organizationId,
          customerId: dto.customerId ?? null,
          cashierId: user.id,
          items: {
            create: lines.map(({ product, quantity, calc }) => ({
              productName: product.name,
              sku: product.sku,
              category: product.category,
              unitPrice: product.price,
              unitCost: product.cost,
              quantity,
              taxRate: calc.taxRate,
              taxAmount: calc.taxAmount,
              lineTotal: calc.lineTotal,
              productId: product.id,
            })),
          },
        },
        include: INVOICE_INCLUDE,
      });
    });
  }

  async findAll(
    user: AuthUser,
    query: InvoiceQueryDto,
  ): Promise<PaginatedResult<unknown>> {
    const { from, to, page = 1, pageSize = 20 } = query;
    const where: Prisma.InvoiceWhereInput = {
      organizationId: user.organizationId,
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: INVOICE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async findOne(user: AuthUser, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, organizationId: user.organizationId },
      include: INVOICE_INCLUDE,
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async renderPdf(user: AuthUser, id: string, res: Response) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { items: true, customer: true, organization: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    res.header('Content-Type', 'application/pdf');
    res.attachment(`${invoice.invoiceNumber}.pdf`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);
    renderInvoicePdf(doc, {
      invoiceNumber: invoice.invoiceNumber,
      createdAt: invoice.createdAt,
      organizationName: invoice.organization.name,
      customerName: invoice.customer?.name,
      paymentMethod: invoice.paymentMethod,
      subtotal: invoice.subtotal,
      discountPercent: invoice.discountPercent,
      discountAmount: invoice.discountAmount,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
      items: invoice.items,
    });
    doc.end();
  }
}
