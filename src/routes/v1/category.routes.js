import express from "express";

import {
  getAllCategories,
  getActiveCategories,
  createCategory,
  updateCategory,
  deactivateCategory,
} from "../../controllers/category.controller.js";

import verifyJWT from "../../middleware/auth.middleware.js";
import verifyAdmin from "../../middleware/admin.middleware.js";
import validate from "../../middleware/validation.middleware.js";
import csrfProtection from "../../middleware/csrf.middleware.js";

import {
  createCategoryValidation,
  updateCategoryValidation,
} from "../../validators/category.validator.js";

const router = express.Router();

// Public route - Get all active categories
router.get("/public", getActiveCategories);

// Admin authentication
router.use(verifyJWT, verifyAdmin);

// Get all categories
router.get("/", getAllCategories);

// Create category
router.post(
  "/",
  csrfProtection,
  createCategoryValidation,
  validate,
  createCategory,
);

// Update category
router.patch(
  "/:categoryId",
  csrfProtection,
  updateCategoryValidation,
  validate,
  updateCategory,
);

// Deactivate category
router.delete("/:categoryId", csrfProtection, deactivateCategory);

export default router;
