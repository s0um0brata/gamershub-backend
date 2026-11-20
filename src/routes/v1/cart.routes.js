import express from "express";

import {
  addToCart,
  removeFromCart,
  getCart,
  clearCart,
} from "../../controllers/cart.controller.js";

import verifyJWT from "../../middleware/auth.middleware.js";
import csrfProtection from "../../middleware/csrf.middleware.js";

const router = express.Router();

// All cart routes require authentication
router.use(verifyJWT);

// Get shopping cart
router.get("/", getCart);

// Add game to cart
router.post("/:gameId", csrfProtection, addToCart);

// Remove game from cart
router.delete("/:gameId", csrfProtection, removeFromCart);

// Clear entire cart
router.delete("/", csrfProtection, clearCart);

export default router;
