const express = require('express');
const AuthController = require('./auth.controller');
const validate = require('../../middleware/validate.middleware');
const { authenticateUser } = require('../../middleware/auth.middleware');
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} = require('./auth.validation');

const router = express.Router();

router.post('/register', validate(registerSchema), AuthController.register);
router.post('/login', validate(loginSchema), AuthController.login);
router.post('/logout', AuthController.logout);
router.get('/me', authenticateUser, AuthController.getMe);
router.post('/forgot-password', validate(forgotPasswordSchema), AuthController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), AuthController.resetPassword);
router.post('/change-password', authenticateUser, validate(changePasswordSchema), AuthController.changePassword);

module.exports = router;
