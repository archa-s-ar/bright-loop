// server/src/utils/pdf-builder.js
const PDFDocument = require('pdfkit');

function formatCurrency(val) {
  const num = Number(val) || 0;
  return `INR ${num.toFixed(2)}`;
}

function formatDate(date) {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Builds a professional Tax Invoice PDF and pipes to output stream.
 */
function buildInvoicePdf(invoice, stream) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(stream);

  // Header
  doc.fillColor('#1e293b').fontSize(22).font('Helvetica-Bold').text('BRIGHTLOOP SOFTWARE', 40, 40);
  doc.fontSize(9).font('Helvetica').fillColor('#64748b').text('Subscription Management System | GSTIN: 29AAAAA0000A1Z5', 40, 68);

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#0f172a').text('TAX INVOICE', 400, 40, { align: 'right' });
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#2563eb').text(invoice.invoiceNumber, 400, 65, { align: 'right' });
  doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(`Status: ${invoice.status}`, 400, 80, { align: 'right' });

  doc.moveTo(40, 100).lineTo(555, 100).strokeColor('#e2e8f0').stroke();

  // Invoice & Customer Metadata
  const topY = 115;
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text('Billed To:', 40, topY);
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#334155').text(invoice.customer.companyName, 40, topY + 16);
  doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(invoice.customer.email, 40, topY + 30);
  if (invoice.customer.billingAddress) {
    doc.text(invoice.customer.billingAddress, 40, topY + 44, { width: 220 });
  }
  if (invoice.customer.taxRegistrationNumber) {
    doc.text(`Tax/GST Reg: ${invoice.customer.taxRegistrationNumber}`, 40, topY + 68);
  }

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#475569');
  doc.text('Invoice Date:', 350, topY);
  doc.font('Helvetica').text(formatDate(invoice.invoiceDate), 450, topY, { align: 'right' });

  doc.font('Helvetica-Bold').text('Due Date:', 350, topY + 16);
  doc.font('Helvetica').text(formatDate(invoice.dueDate), 450, topY + 16, { align: 'right' });

  doc.font('Helvetica-Bold').text('Billing Period:', 350, topY + 32);
  doc.font('Helvetica').text(`${formatDate(invoice.billingPeriodStart)} - ${formatDate(invoice.billingPeriodEnd)}`, 450, topY + 32, { align: 'right' });

  doc.font('Helvetica-Bold').text('Currency:', 350, topY + 48);
  doc.font('Helvetica').text(invoice.currency || 'INR', 450, topY + 48, { align: 'right' });

  // Line Items Table Header
  const tableY = 210;
  doc.rect(40, tableY, 515, 24).fill('#f8fafc');
  doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold');
  doc.text('Item / Description', 50, tableY + 7);
  doc.text('Qty', 290, tableY + 7, { width: 40, align: 'center' });
  doc.text('Unit Price', 340, tableY + 7, { width: 70, align: 'right' });
  doc.text('Tax', 420, tableY + 7, { width: 50, align: 'right' });
  doc.text('Total', 480, tableY + 7, { width: 65, align: 'right' });

  let curY = tableY + 28;
  doc.font('Helvetica').fontSize(9).fillColor('#1e293b');

  (invoice.lines || []).forEach((line) => {
    doc.text(line.descriptionSnapshot, 50, curY, { width: 230 });
    doc.text(String(line.quantity), 290, curY, { width: 40, align: 'center' });
    doc.text(formatCurrency(line.unitPrice), 340, curY, { width: 70, align: 'right' });
    doc.text(formatCurrency(line.taxAmount), 420, curY, { width: 50, align: 'right' });
    doc.text(formatCurrency(line.lineTotal), 480, curY, { width: 65, align: 'right' });
    curY += 24;
    doc.moveTo(40, curY - 4).lineTo(555, curY - 4).strokeColor('#f1f5f9').stroke();
  });

  // Summary Totals
  curY = Math.max(curY + 10, 360);
  doc.moveTo(320, curY).lineTo(555, curY).strokeColor('#cbd5e1').stroke();
  curY += 8;

  doc.font('Helvetica').fillColor('#64748b');
  doc.text('Subtotal:', 340, curY);
  doc.fillColor('#0f172a').text(formatCurrency(invoice.subtotal), 450, curY, { align: 'right' });
  curY += 16;

  if (Number(invoice.discountTotal) > 0) {
    doc.fillColor('#16a34a').text('Discount:', 340, curY);
    doc.text(`-${formatCurrency(invoice.discountTotal)}`, 450, curY, { align: 'right' });
    curY += 16;
  }

  doc.fillColor('#64748b').text('Tax Total:', 340, curY);
  doc.fillColor('#0f172a').text(formatCurrency(invoice.taxTotal), 450, curY, { align: 'right' });
  curY += 16;

  doc.moveTo(320, curY).lineTo(555, curY).strokeColor('#cbd5e1').stroke();
  curY += 8;

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a');
  doc.text('Total Amount:', 340, curY);
  doc.fillColor('#2563eb').text(formatCurrency(invoice.totalAmount), 450, curY, { align: 'right' });
  curY += 22;

  // Outstanding / Paid balance
  if (invoice.paidAmount !== undefined || invoice.outstandingAmount !== undefined) {
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#16a34a');
    doc.text('Amount Paid:', 340, curY);
    doc.text(formatCurrency(invoice.paidAmount || 0), 450, curY, { align: 'right' });
    curY += 14;

    doc.fillColor('#dc2626');
    doc.text('Balance Due:', 340, curY);
    doc.text(formatCurrency(invoice.outstandingAmount !== undefined ? invoice.outstandingAmount : invoice.totalAmount), 450, curY, { align: 'right' });
    curY += 20;
  }

  // Footer notes
  doc.fontSize(8).font('Helvetica').fillColor('#94a3b8').text(
    'Thank you for your business. For any billing questions or support, contact billing@brightloop.local.',
    40,
    740,
    { align: 'center', width: 515 }
  );

  doc.end();
}

/**
 * Builds a Quotation PDF and pipes to output stream.
 */
function buildQuotationPdf(quote, stream) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(stream);

  // Header
  doc.fillColor('#1e293b').fontSize(22).font('Helvetica-Bold').text('BRIGHTLOOP SOFTWARE', 40, 40);
  doc.fontSize(9).font('Helvetica').fillColor('#64748b').text('Official Subscription Proposal', 40, 68);

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#0f172a').text('QUOTATION', 400, 40, { align: 'right' });
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#0284c7').text(quote.quotationNumber, 400, 65, { align: 'right' });
  doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(`Status: ${quote.status}`, 400, 80, { align: 'right' });

  doc.moveTo(40, 100).lineTo(555, 100).strokeColor('#e2e8f0').stroke();

  // Quote Metadata
  const topY = 115;
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text('Prepared For:', 40, topY);
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#334155').text(quote.customer.companyName, 40, topY + 16);
  doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(quote.customer.email, 40, topY + 30);

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#475569');
  doc.text('Quotation Date:', 350, topY);
  doc.font('Helvetica').text(formatDate(quote.quotationDate), 450, topY, { align: 'right' });

  doc.font('Helvetica-Bold').text('Valid Until:', 350, topY + 16);
  doc.font('Helvetica').text(formatDate(quote.expiryDate), 450, topY + 16, { align: 'right' });

  // Line Items
  const tableY = 190;
  doc.rect(40, tableY, 515, 24).fill('#f8fafc');
  doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold');
  doc.text('Item / Description', 50, tableY + 7);
  doc.text('Qty', 290, tableY + 7, { width: 40, align: 'center' });
  doc.text('Unit Price', 340, tableY + 7, { width: 70, align: 'right' });
  doc.text('Tax', 420, tableY + 7, { width: 50, align: 'right' });
  doc.text('Total', 480, tableY + 7, { width: 65, align: 'right' });

  let curY = tableY + 28;
  doc.font('Helvetica').fontSize(9).fillColor('#1e293b');

  (quote.lines || []).forEach((line) => {
    doc.text(line.descriptionSnapshot, 50, curY, { width: 230 });
    doc.text(String(line.quantity), 290, curY, { width: 40, align: 'center' });
    doc.text(formatCurrency(line.unitPrice), 340, curY, { width: 70, align: 'right' });
    doc.text(formatCurrency(line.taxAmount), 420, curY, { width: 50, align: 'right' });
    doc.text(formatCurrency(line.lineTotal), 480, curY, { width: 65, align: 'right' });
    curY += 24;
    doc.moveTo(40, curY - 4).lineTo(555, curY - 4).strokeColor('#f1f5f9').stroke();
  });

  // Summary Totals
  curY = Math.max(curY + 10, 320);
  doc.moveTo(320, curY).lineTo(555, curY).strokeColor('#cbd5e1').stroke();
  curY += 8;

  doc.font('Helvetica').fillColor('#64748b');
  doc.text('Subtotal:', 340, curY);
  doc.fillColor('#0f172a').text(formatCurrency(quote.subtotal), 450, curY, { align: 'right' });
  curY += 16;

  if (Number(quote.discountTotal) > 0) {
    doc.fillColor('#16a34a').text('Discount Total:', 340, curY);
    doc.text(`-${formatCurrency(quote.discountTotal)}`, 450, curY, { align: 'right' });
    curY += 16;
  }

  doc.fillColor('#64748b').text('Tax Total:', 340, curY);
  doc.fillColor('#0f172a').text(formatCurrency(quote.taxTotal), 450, curY, { align: 'right' });
  curY += 16;

  doc.moveTo(320, curY).lineTo(555, curY).strokeColor('#cbd5e1').stroke();
  curY += 8;

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a');
  doc.text('Total Proposed:', 340, curY);
  doc.fillColor('#0284c7').text(formatCurrency(quote.totalAmount), 450, curY, { align: 'right' });

  doc.fontSize(8).font('Helvetica').fillColor('#94a3b8').text(
    'This proposal is confidential and subject to Brightloop standard subscription terms. To accept, please sign or confirm in the customer portal.',
    40,
    740,
    { align: 'center', width: 515 }
  );

  doc.end();
}

module.exports = {
  buildInvoicePdf,
  buildQuotationPdf,
};

