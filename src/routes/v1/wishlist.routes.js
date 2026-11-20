import express from "express";

import {
  addToWishlist,
  removeFromWishlist,
  getWishlist,
} from "../../controllers/wishlist.controller.js";

import verifyJWT from "../../middleware/auth.middleware.js";
import csrfProtection from "../../middleware/csrf.middleware.js";

const router = express.Router();

// All wishlist routes require authentication
router.use(verifyJWT);

// Get user's wishlist
router.get("/", getWishlist);

// Add game to wishlist
router.post("/:gameId", csrfProtection, addToWishlist);

// Remove game from wishlist
router.delete("/:gameId", csrfProtection, removeFromWishlist);

export default router;
