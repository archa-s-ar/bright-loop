// src/modules/catalog/controllers/product.controller.js
const productService = require('../services/product.service');

async function listProducts(req, res, next) {
  try {
    const { page, limit, search, status, productType } = req.query;
    const role = req.user?.role;
    const result = await productService.listProducts({ page, limit, search, status, productType, role });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function getProductById(req, res, next) {
  try {
    const { id } = req.params;
    const product = await productService.getProductById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    // CUSTOMER role cannot view non-ACTIVE products
    if (req.user?.role === 'CUSTOMER' && product.status !== 'ACTIVE') {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

async function createProduct(req, res, next) {
  try {
    const product = await productService.createProduct(req.body);
    res.status(201).json({ success: true, message: 'Product created successfully.', data: product });
  } catch (err) {
    next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const product = await productService.updateProduct(id, req.body);
    res.json({ success: true, message: 'Product updated successfully.', data: product });
  } catch (err) {
    next(err);
  }
}

async function setProductStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const product = await productService.setProductStatus(id, status);
    res.json({ success: true, message: `Product status updated to ${status}.`, data: product });
  } catch (err) {
    next(err);
  }
}

async function listVariants(req, res, next) {
  try {
    const { id } = req.params;
    const variants = await productService.listVariants(id);
    res.json({ success: true, data: variants });
  } catch (err) {
    next(err);
  }
}

async function createVariant(req, res, next) {
  try {
    const { id } = req.params;
    const variant = await productService.createVariant(id, req.body);
    res.status(201).json({ success: true, message: 'Product variant created successfully.', data: variant });
  } catch (err) {
    next(err);
  }
}

async function updateVariant(req, res, next) {
  try {
    const { id } = req.params;
    const variant = await productService.updateVariant(id, req.body);
    res.json({ success: true, message: 'Product variant updated successfully.', data: variant });
  } catch (err) {
    next(err);
  }
}

async function deleteVariant(req, res, next) {
  try {
    const { id } = req.params;
    await productService.deleteVariant(id);
    res.json({ success: true, message: 'Product variant deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  setProductStatus,
  listVariants,
  createVariant,
  updateVariant,
  deleteVariant
};

