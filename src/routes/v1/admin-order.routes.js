import { Router } from "express";

import { getAllOrders, getAdminOrderById, updateOrderStatus } from "../../controllers/order.controller.js";

import verifyJWT from "../../middleware/auth.middleware.js";
import verifyAdmin from "../../middleware/admin.middleware.js";
import csrfProtection from "../../middleware/csrf.middleware.js";

const router = Router();

// All routes require admin authentication
router.use(verifyJWT, verifyAdmin);

// Get all customer orders
router.get("/", getAllOrders);

// Get individual customer order details
router.get("/:orderId", getAdminOrderById);

// Update customer order status
router.patch("/:orderId/status", csrfProtection, updateOrderStatus);

export default router;
