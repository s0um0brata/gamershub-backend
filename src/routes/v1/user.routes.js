import express from "express";

import {
  getCurrentUser,
  updateProfile,
  changePassword,
  logout,
} from "../../controllers/user.controller.js";

import {
  addToWishlist,
  removeFromWishlist,
  getWishlist,
} from "../../controllers/wishlist.controller.js";

import verifyJWT from "../../middleware/auth.middleware.js";
import validate from "../../middleware/validation.middleware.js";
import csrfProtection from "../../middleware/csrf.middleware.js";
import upload from "../../middleware/upload.middleware.js";

import {
  updateProfileValidation,
  changePasswordValidation,
} from "../../validators/user.validator.js";

const router = express.Router();

// Get Current User Profile
router.get("/profile", verifyJWT, getCurrentUser);

// Update User Profile (including profile picture)
router.patch(
  "/profile",
  verifyJWT,
  csrfProtection,
  upload.single("profilePicture"),
  updateProfileValidation,
  validate,
  updateProfile,
);

// Change Password
router.patch(
  "/change-password",
  verifyJWT,
  csrfProtection,
  changePasswordValidation,
  validate,
  changePassword,
);

// Logout
router.post("/logout", verifyJWT, csrfProtection, logout);

// Wishlist Routes
router.get("/wishlist", verifyJWT, getWishlist);

router.post("/wishlist/:gameId", verifyJWT, csrfProtection, addToWishlist);

router.delete(
  "/wishlist/:gameId",
  verifyJWT,
  csrfProtection,
  removeFromWishlist,
);

export default router;
