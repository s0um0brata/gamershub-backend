import { body } from "express-validator";

// Create Game Validation
export const createGameValidation = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Game title is required")
    .isLength({ max: 150 })
    .withMessage("Game title cannot exceed 150 characters"),

  body("slug")
    .trim()
    .notEmpty()
    .withMessage("Game slug is required")
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage(
      "Slug must contain lowercase letters, numbers, and hyphens only",
    ),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Game description is required"),

  body("shortDescription")
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage("Short description cannot exceed 300 characters"),

  body("price")
    .isFloat({ min: 0 })
    .withMessage("Price must be a valid non-negative number"),

  body("discountPrice")
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage("Discount price must be a valid non-negative number")
    .custom((value, { req }) => {
      if (Number(value) >= Number(req.body.price)) {
        throw new Error("Discount price must be lower than regular price");
      }
      return true;
    }),

  body("developer").optional().trim(),

  body("publisher").optional().trim(),

  body("releaseDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid release date"),

  body("platforms")
    .optional()
    .isArray({ min: 1 })
    .withMessage("At least one platform is required"),

  body("genres").optional().isArray().withMessage("Genres must be an array"),

  // Categories Validation
  body("categories")
    .optional()
    .isArray()
    .withMessage("Categories must be an array"),

  body("categories.*")
    .isMongoId()
    .withMessage("Each category must have a valid MongoDB ID"),

  body("status")
    .optional()
    .isIn(["draft", "published", "archived"])
    .withMessage("Invalid game status"),

  body("isFeatured")
    .optional()
    .isBoolean()
    .withMessage("isFeatured must be true or false"),

  body("systemRequirements")
    .optional()
    .isObject()
    .withMessage("System requirements must be an object"),
];

// Update Game Validation
export const updateGameValidation = [
  body("title")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Game title cannot be empty")
    .isLength({ max: 150 })
    .withMessage("Game title cannot exceed 150 characters"),

  body("slug")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Game slug cannot be empty")
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage(
      "Slug must contain lowercase letters, numbers, and hyphens only",
    ),

  body("description")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Game description cannot be empty"),

  body("shortDescription")
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage("Short description cannot exceed 300 characters"),

  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must be a valid non-negative number"),

  body("discountPrice")
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage("Discount price must be a valid non-negative number")
    .custom((value, { req }) => {
      if (
        req.body.price !== undefined &&
        Number(value) >= Number(req.body.price)
      ) {
        throw new Error("Discount price must be lower than regular price");
      }
      return true;
    }),

  body("developer").optional().trim(),

  body("publisher").optional().trim(),

  body("releaseDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid release date"),

  body("genres").optional().isArray().withMessage("Genres must be an array"),

  body("platforms")
    .optional()
    .isArray({ min: 1 })
    .withMessage("At least one platform is required"),

  // Categories Validation
  body("categories")
    .optional()
    .isArray()
    .withMessage("Categories must be an array"),

  body("categories.*")
    .isMongoId()
    .withMessage("Each category must have a valid MongoDB ID"),

  body("systemRequirements")
    .optional()
    .isObject()
    .withMessage("System requirements must be an object"),

  body("status")
    .optional()
    .isIn(["draft", "published", "archived"])
    .withMessage("Invalid game status"),

  body("isFeatured")
    .optional()
    .isBoolean()
    .withMessage("isFeatured must be true or false"),
];
