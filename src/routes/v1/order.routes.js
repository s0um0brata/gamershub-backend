import { Router } from "express";

import {
  placeOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
} from "../../controllers/order.controller.js";

import verifyJWT from "../../middleware/auth.middleware.js";
import csrfProtection from "../../middleware/csrf.middleware.js";

const router = Router();

// All order routes require authentication
router.use(verifyJWT);

// Place a new order
router.post("/", csrfProtection, placeOrder);

// Get logged-in customer's order history
router.get("/", getMyOrders);

// Get individual order details
router.get("/:orderId", getOrderById);

// Cancel a customer order
router.delete("/:orderId/cancel", csrfProtection, cancelOrder);

export default router;
