import { Router } from "express";
import {
  createPaymentSession,
  verifyPaymentSession,
} from "../../controllers/payment.controller.js";
import verifyJWT from "../../middleware/auth.middleware.js";
import csrfProtection from "../../middleware/csrf.middleware.js";

const router = Router();

router.use(verifyJWT);

router.post("/create-session", csrfProtection, createPaymentSession);

router.get("/verify/:sessionId", verifyPaymentSession);

export default router;
