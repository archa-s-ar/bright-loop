// server/src/modules/quotations/controllers/quotation-template.controller.js
const templateService = require('../services/quotation-template.service');
const ApiResponse = require('../../../utils/apiResponse');

async function listTemplates(req, res, next) {
  try {
    const result = await templateService.listTemplates(req.query);
    return ApiResponse.success(res, result, 'Quotation templates retrieved');
  } catch (err) {
    next(err);
  }
}

async function getTemplateById(req, res, next) {
  try {
    const template = await templateService.getTemplateById(req.params.id);
    return ApiResponse.success(res, template, 'Quotation template retrieved');
  } catch (err) {
    next(err);
  }
}

async function createTemplate(req, res, next) {
  try {
    const template = await templateService.createTemplate(req.body);
    return ApiResponse.created(res, template, 'Quotation template created successfully');
  } catch (err) {
    next(err);
  }
}

async function updateTemplate(req, res, next) {
  try {
    const template = await templateService.updateTemplate(req.params.id, req.body);
    return ApiResponse.success(res, template, 'Quotation template updated successfully');
  } catch (err) {
    next(err);
  }
}

async function deactivateTemplate(req, res, next) {
  try {
    const template = await templateService.deactivateTemplate(req.params.id);
    return ApiResponse.success(res, template, 'Quotation template deactivated');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deactivateTemplate,
};

