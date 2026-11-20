import express from "express";

import {
  getAdminDashboard,
  getAdminGames,
  getAdminGameById,
  createGame,
  updateGame,
  deleteGame,
  removeGameScreenshot,
  permanentlyDeleteGame,
} from "../../controllers/admin.controller.js";

import verifyJWT from "../../middleware/auth.middleware.js";
import verifyAdmin from "../../middleware/admin.middleware.js";
import validate from "../../middleware/validation.middleware.js";
import csrfProtection from "../../middleware/csrf.middleware.js";
import upload from "../../middleware/upload.middleware.js";

import {
  createGameValidation,
  updateGameValidation,
} from "../../validators/game.validator.js";

import ApiError from "../../utils/ApiError.js";

const router = express.Router();

// Parse JSON fields sent through multipart/form-data
const parseGameFormData = (req, res, next) => {
  try {
    const jsonFields = [
      "genres",
      "platforms",
      "systemRequirements",
      "categories",
    ];

    for (const field of jsonFields) {
      if (typeof req.body[field] === "string") {
        try {
          req.body[field] = JSON.parse(req.body[field]);
        } catch {
          throw new ApiError(400, `Invalid JSON format for ${field}`);
        }
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Multer image fields
const gameImageUpload = upload.fields([
  {
    name: "coverImage",
    maxCount: 1,
  },
  {
    name: "screenshots",
    maxCount: 5,
  },
]);

// Admin Dashboard
router.get("/dashboard", verifyJWT, verifyAdmin, getAdminDashboard);

// Get All Games (Admin Only)
router.get("/games", verifyJWT, verifyAdmin, getAdminGames);

// Create New Game
router.post(
  "/games",
  verifyJWT,
  verifyAdmin,
  csrfProtection,
  gameImageUpload,
  parseGameFormData,
  createGameValidation,
  validate,
  createGame,
);

// Get Single Game for Admin Editing
router.get("/games/:gameId", verifyJWT, verifyAdmin, getAdminGameById);

// Update Existing Game
router.patch(
  "/games/:gameId",
  verifyJWT,
  verifyAdmin,
  csrfProtection,
  gameImageUpload,
  parseGameFormData,
  updateGameValidation,
  validate,
  updateGame,
);

// Remove Individual Game Screenshot
router.delete(
  "/games/:gameId/screenshots/:index",
  verifyJWT,
  verifyAdmin,
  csrfProtection,
  removeGameScreenshot,
);

// Permanently Delete Game and Its Cloudinary Images
router.delete(
  "/games/:gameId/permanent",
  verifyJWT,
  verifyAdmin,
  csrfProtection,
  permanentlyDeleteGame,
);

// Delete Game (Soft Delete)
router.delete(
  "/games/:gameId",
  verifyJWT,
  verifyAdmin,
  csrfProtection,
  deleteGame,
);

export default router;
