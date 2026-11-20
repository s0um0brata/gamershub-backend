import express from "express";

import {
  createReview,
  getGameReviews,
  getMyReviews,
  updateReview,
  deleteReview,
} from "../../controllers/review.controller.js";

import verifyJWT from "../../middleware/auth.middleware.js";
import csrfProtection from "../../middleware/csrf.middleware.js";
import validate from "../../middleware/validation.middleware.js";

import {
  createReviewValidation,
  updateReviewValidation,
} from "../../validators/review.validator.js";

const router = express.Router();

// Get reviews for a particular game (Public)
router.get("/game/:gameId", getGameReviews);

// Get reviews submitted by the logged-in customer
router.get("/my", verifyJWT, getMyReviews);

// Create a review
router.post(
  "/game/:gameId",
  verifyJWT,
  csrfProtection,
  createReviewValidation,
  validate,
  createReview,
);

// Update your own review
router.patch(
  "/:reviewId",
  verifyJWT,
  csrfProtection,
  updateReviewValidation,
  validate,
  updateReview,
);

// Delete your own review
router.delete("/:reviewId", verifyJWT, csrfProtection, deleteReview);

export default router;
