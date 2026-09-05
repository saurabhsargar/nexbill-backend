export interface GstSummaryData {
  grossSales: number;
  returns: number;
  netSales: number;
  gstCollected: number;
  inputTaxCredit: number;
  netGstPayable: number;
}

const money = (value: number) => value.toFixed(2);

/**
 * Standalone so Phase 5's `/exports/tax-reports` can reuse it later without rework.
 */
export function renderGstReportPdf(
  doc: PDFKit.PDFDocument,
  summary: GstSummaryData,
  organizationName: string,
  from?: string,
  to?: string,
) {
  doc.fontSize(18).text(organizationName);
  doc.fontSize(12).text('GST Summary Report');
  doc.fontSize(10).text(`Period: ${from ?? 'inception'} - ${to ?? 'present'}`);
  doc.moveDown();

  const rows: [string, number][] = [
    ['Gross Sales', summary.grossSales],
    ['Returns', summary.returns],
    ['Net Sales', summary.netSales],
    ['GST Collected', summary.gstCollected],
    ['Input Tax Credit', summary.inputTaxCredit],
    ['Net GST Payable', summary.netGstPayable],
  ];

  for (const [label, value] of rows) {
    doc.fontSize(11).text(`${label}: ${money(value)}`);
  }
}
