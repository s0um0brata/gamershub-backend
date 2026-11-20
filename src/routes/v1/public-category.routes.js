import express from "express";

import { getActiveCategories } from "../../controllers/category.controller.js";

const router = express.Router();

// Public route: Get active categories
router.get("/", getActiveCategories);

export default router;
