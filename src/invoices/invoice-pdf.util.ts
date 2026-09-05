import { Prisma } from '@prisma/client';

export interface InvoicePdfItem {
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: Prisma.Decimal | number | string;
  taxRate: Prisma.Decimal | number | string;
  taxAmount: Prisma.Decimal | number | string;
  lineTotal: Prisma.Decimal | number | string;
}

export interface InvoicePdfData {
  invoiceNumber: string;
  createdAt: Date;
  organizationName: string;
  customerName?: string | null;
  paymentMethod: string;
  subtotal: Prisma.Decimal | number | string;
  discountPercent: Prisma.Decimal | number | string;
  discountAmount: Prisma.Decimal | number | string;
  taxAmount: Prisma.Decimal | number | string;
  total: Prisma.Decimal | number | string;
  items: InvoicePdfItem[];
}

const money = (value: unknown) => Number(value).toFixed(2);

export function renderInvoicePdf(
  doc: PDFKit.PDFDocument,
  invoice: InvoicePdfData,
) {
  doc.fontSize(18).text(invoice.organizationName, { align: 'left' });
  doc.fontSize(10).text(`Invoice ${invoice.invoiceNumber}`);
  doc.text(`Date: ${invoice.createdAt.toLocaleDateString()}`);
  doc.text(`Customer: ${invoice.customerName ?? 'Walk-in'}`);
  doc.text(`Payment method: ${invoice.paymentMethod}`);
  doc.moveDown();

  const tableTop = doc.y;
  doc.fontSize(9).text('Item', 50, tableTop);
  doc.text('SKU', 220, tableTop);
  doc.text('Qty', 300, tableTop);
  doc.text('Unit Price', 340, tableTop);
  doc.text('Tax', 420, tableTop);
  doc.text('Line Total', 470, tableTop);
  doc.moveDown();

  for (const item of invoice.items) {
    const y = doc.y;
    doc.text(item.productName, 50, y, { width: 160 });
    doc.text(item.sku, 220, y);
    doc.text(String(item.quantity), 300, y);
    doc.text(money(item.unitPrice), 340, y);
    doc.text(money(item.taxAmount), 420, y);
    doc.text(money(item.lineTotal), 470, y);
    doc.moveDown();
  }

  doc.moveDown();
  doc.text(`Subtotal: ${money(invoice.subtotal)}`, { align: 'right' });
  doc.text(
    `Discount (${Number(invoice.discountPercent).toFixed(2)}%): -${money(invoice.discountAmount)}`,
    { align: 'right' },
  );
  doc.text(`Tax: ${money(invoice.taxAmount)}`, { align: 'right' });
  doc.fontSize(12).text(`Total: ${money(invoice.total)}`, { align: 'right' });
}
