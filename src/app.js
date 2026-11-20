import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import notFound from "./middleware/notFound.middleware.js";
import errorHandler from "./middleware/error.middleware.js";
import apiV1Routes from "./routes/v1/index.js";
import { handleStripeWebhook } from "./controllers/stripe-webhook.controller.js";

const app = express();

// Security Middleware
app.use(helmet());

// CORS Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
);

// Logging Middleware
app.use(morgan("dev"));

// Stripe Webhook - Must be registered before JSON body parsing
app.post(
  "/api/v1/payments/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook,
);

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie Parser Middleware
app.use(cookieParser());

// Health Check Route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "PC Game Store Backend API is running...",
  });
});

// API Version 1 Routes
app.use("/api/v1", apiV1Routes);

// 404 Middleware
app.use(notFound);

// Error Middleware
app.use(errorHandler);

export default app;
