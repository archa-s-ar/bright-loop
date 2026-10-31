// server/src/modules/quotations/controllers/quotation.controller.js
const quotationService = require('../services/quotation.service');
const { convertQuotationToSubscription } = require('../services/quotation-converter.service');
const ApiResponse = require('../../../utils/apiResponse');
const pdfBuilder = require('../../../utils/pdf-builder');

async function listQuotations(req, res, next) {
  try {
    const result = await quotationService.listQuotations(req.query, req.user);
    return ApiResponse.success(res, result, 'Quotations retrieved successfully');
  } catch (err) {
    next(err);
  }
}

async function getQuotationById(req, res, next) {
  try {
    const quote = await quotationService.getQuotationById(req.params.id, req.user);
    return ApiResponse.success(res, quote, 'Quotation details retrieved');
  } catch (err) {
    next(err);
  }
}

async function createQuotation(req, res, next) {
  try {
    const quote = await quotationService.createQuotation(req.body, req.user);
    return ApiResponse.created(res, quote, 'Quotation drafted successfully');
  } catch (err) {
    next(err);
  }
}

async function sendQuotation(req, res, next) {
  try {
    const quote = await quotationService.transitionStatus(req.params.id, 'SENT', req.user);
    return ApiResponse.success(res, quote, 'Quotation marked as SENT to customer');
  } catch (err) {
    next(err);
  }
}

async function acceptQuotation(req, res, next) {
  try {
    const quote = await quotationService.transitionStatus(req.params.id, 'ACCEPTED', req.user);
    return ApiResponse.success(res, quote, 'Quotation accepted');
  } catch (err) {
    next(err);
  }
}

async function rejectQuotation(req, res, next) {
  try {
    const quote = await quotationService.transitionStatus(req.params.id, 'REJECTED', req.user);
    return ApiResponse.success(res, quote, 'Quotation rejected');
  } catch (err) {
    next(err);
  }
}

async function convertQuotation(req, res, next) {
  try {
    const subscription = await convertQuotationToSubscription(req.params.id, req.user, req.body);
    return ApiResponse.created(res, subscription, 'Quotation successfully converted to active Subscription');
  } catch (err) {
    next(err);
  }
}

async function downloadPdf(req, res, next) {
  try {
    const quote = await quotationService.getQuotationById(req.params.id, req.user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Quotation-${quote.quotationNumber}.pdf"`);
    pdfBuilder.buildQuotationPdf(quote, res);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listQuotations,
  getQuotationById,
  createQuotation,
  sendQuotation,
  acceptQuotation,
  rejectQuotation,
  convertQuotation,
  downloadPdf,
};

