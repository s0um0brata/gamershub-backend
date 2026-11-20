import { Router } from "express";

import {
  register,
  login,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
} from "../../controllers/auth.controller.js";

import {
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} from "../../validators/auth.validator.js";

import validate from "../../middleware/validation.middleware.js";
import csrfProtection from "../../middleware/csrf.middleware.js";

import {
  loginLimiter,
  registerLimiter,
  refreshTokenLimiter,
  forgotPasswordLimiter,
} from "../../middleware/rateLimit.middleware.js";

const router = Router();

// Register
router.post(
  "/register",
  registerLimiter,
  csrfProtection,
  registerValidation,
  validate,
  register,
);

// Login
router.post(
  "/login",
  loginLimiter,
  csrfProtection,
  loginValidation,
  validate,
  login,
);

// Refresh access token
router.post(
  "/refresh-token",
  refreshTokenLimiter,
  csrfProtection,
  refreshAccessToken,
);

// Forgot Password
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  csrfProtection,
  forgotPasswordValidation,
  validate,
  forgotPassword,
);

// Reset Password
router.post(
  "/reset-password",
  csrfProtection,
  resetPasswordValidation,
  validate,
  resetPassword,
);

export default router;
