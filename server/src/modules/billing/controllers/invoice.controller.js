// server/src/modules/billing/controllers/invoice.controller.js
const invoiceService = require('../services/invoice.service');
const ApiResponse = require('../../../utils/apiResponse');
const pdfBuilder = require('../../../utils/pdf-builder');

async function listInvoices(req, res, next) {
  try {
    const result = await invoiceService.listInvoices(req.query, req.user);
    return ApiResponse.success(res, result, 'Invoices retrieved successfully');
  } catch (err) {
    next(err);
  }
}

async function getInvoiceById(req, res, next) {
  try {
    const invoice = await invoiceService.getInvoiceById(req.params.id, req.user);
    return ApiResponse.success(res, invoice, 'Invoice details retrieved');
  } catch (err) {
    next(err);
  }
}

async function createManualInvoice(req, res, next) {
  try {
    const invoice = await invoiceService.generateInvoiceForSubscription(
      req.body.subscriptionId,
      req.body
    );
    return ApiResponse.created(res, invoice, 'Invoice generated successfully');
  } catch (err) {
    next(err);
  }
}

async function confirmInvoice(req, res, next) {
  try {
    const invoice = await invoiceService.confirmInvoice(req.params.id, req.user);
    return ApiResponse.success(res, invoice, 'Invoice confirmed');
  } catch (err) {
    next(err);
  }
}

async function cancelInvoice(req, res, next) {
  try {
    const invoice = await invoiceService.cancelInvoice(req.params.id, req.user);
    return ApiResponse.success(res, invoice, 'Invoice cancelled');
  } catch (err) {
    next(err);
  }
}

async function downloadPdf(req, res, next) {
  try {
    const invoice = await invoiceService.getInvoiceById(req.params.id, req.user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Invoice-${invoice.invoiceNumber}.pdf"`);
    pdfBuilder.buildInvoicePdf(invoice, res);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listInvoices,
  getInvoiceById,
  createManualInvoice,
  confirmInvoice,
  cancelInvoice,
  downloadPdf,
};

