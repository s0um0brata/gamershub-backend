import express from "express";

import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import adminRoutes from "./admin.routes.js";
import gameRoutes from "./game.routes.js";
import categoryRoutes from "./category.routes.js";
import publicCategoryRoutes from "./public-category.routes.js";
import wishlistRoutes from "./wishlist.routes.js";
import cartRoutes from "./cart.routes.js";
import orderRouter from "./order.routes.js";
import adminOrderRouter from "./admin-order.routes.js";
import paymentRoutes from "./payment.routes.js";
import reviewRoutes from "./review.routes.js";

const router = express.Router();

// Authentication routes
router.use("/auth", authRoutes);

// User routes
router.use("/users", userRoutes);

// Wishlist routes
router.use("/wishlist", wishlistRoutes);

// Shopping Cart routes
router.use("/cart", cartRoutes);

// Admin routes
router.use("/admin", adminRoutes);

// Admin Category routes
router.use("/admin/categories", categoryRoutes);

// Public Category routes
router.use("/categories", publicCategoryRoutes);

// Public Game routes
router.use("/games", gameRoutes);

// Order routes
router.use("/orders", orderRouter);

// Admin Order routes
router.use("/admin/orders", adminOrderRouter);

// Payment routes
router.use("/payments", paymentRoutes);

// Review routes
router.use("/reviews", reviewRoutes);

export default router;
