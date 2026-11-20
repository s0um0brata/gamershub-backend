import mongoose from "mongoose";

import Order from "../models/Order.model.js";
import User from "../models/User.model.js";

import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

import stripe from "../config/stripe.config.js";
import { createCheckoutSession } from "../services/stripe.service.js";

// Create Stripe Checkout Session
export const createPaymentSession = asyncHandler(async (req, res) => {
  const { orderId } = req.body;

  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "A valid order ID is required");
  }

  const order = await Order.findOne({
    _id: orderId,
    user: req.user._id,
  });

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (order.orderStatus !== "pending") {
    throw new ApiError(409, "This order is not available for payment");
  }

  if (order.paymentStatus !== "pending") {
    throw new ApiError(409, "This order is not awaiting payment");
  }

  const customer = await User.findById(req.user._id).select("email");

  if (!customer?.email) {
    throw new ApiError(400, "Customer email is required");
  }

  // Reuse an existing active Stripe Checkout Session.
  if (order.stripeCheckoutSessionId) {
    const existingSession = await stripe.checkout.sessions.retrieve(
      order.stripeCheckoutSessionId,
    );

    if (existingSession.status === "open" && existingSession.url) {
      return res.status(200).json(
        new ApiResponse(200, "Existing payment session returned", {
          checkoutUrl: existingSession.url,
          sessionId: existingSession.id,
        }),
      );
    }

    if (existingSession.payment_status === "paid") {
      throw new ApiError(
        409,
        "Payment has already been completed. Please refresh your order.",
      );
    }
  }

  const session = await createCheckoutSession({
    order,
    customerEmail: customer.email,
    // idempotencyKey: `checkout-${order._id}-${order.updatedAt.getTime()}`,
    idempotencyKey: `checkout-${order._id}-${Date.now()}`,
  });

  // Store the Stripe session only while the order remains unpaid.
  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      user: req.user._id,
      orderStatus: "pending",
      paymentStatus: "pending",
    },
    {
      $set: {
        paymentMethod: "stripe",
        stripeCheckoutSessionId: session.id,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updatedOrder) {
    throw new ApiError(
      409,
      "Order changed while payment was being initialized. Please refresh your order.",
    );
  }

  return res.status(201).json(
    new ApiResponse(201, "Stripe payment session created", {
      checkoutUrl: session.url,
      sessionId: session.id,
    }),
  );
});

export const verifyPaymentSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    throw new ApiError(400, "Stripe session ID is required");
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  const orderId = session.metadata?.orderId;

  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid order reference");
  }

  const order = await Order.findOne({
    _id: orderId,
    user: req.user._id,
    stripeCheckoutSessionId: sessionId,
  });

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const isPaid =
    session.payment_status === "paid" && order.paymentStatus === "paid";

  return res.status(200).json(
    new ApiResponse(200, "Payment verification completed", {
      isPaid,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
    }),
  );
});
