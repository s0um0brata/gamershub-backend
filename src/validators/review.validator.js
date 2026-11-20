import { body } from "express-validator";

// Create Review Validation
export const createReviewValidation = [
  body("rating")
    .notEmpty()
    .withMessage("Rating is required")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be a whole number between 1 and 5")
    .toInt(),

  body("comment")
    .trim()
    .notEmpty()
    .withMessage("Review comment is required")
    .isLength({ min: 5, max: 1000 })
    .withMessage("Review must be between 5 and 1000 characters"),
];

// Update Review Validation
export const updateReviewValidation = [
  body().custom((value, { req }) => {
    if (req.body.rating === undefined && req.body.comment === undefined) {
      throw new Error("Please provide a rating or comment to update");
    }

    return true;
  }),

  body("rating")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be a whole number between 1 and 5")
    .toInt(),

  body("comment")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Review comment cannot be empty")
    .isLength({ min: 5, max: 1000 })
    .withMessage("Review must be between 5 and 1000 characters"),
];
