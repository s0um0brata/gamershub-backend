import mongoose from "mongoose";

import stripe from "../config/stripe.config.js";
import Order from "../models/Order.model.js";
import StripeWebhookEvent from "../models/StripeWebhookEvent.model.js";

export const handleStripeWebhook = async (req, res) => {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return res.status(400).json({
      success: false,
      message: "Missing Stripe webhook signature or configuration",
    });
  }

  let event;

  // 1. Verify Stripe webhook signature.
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe signature verification failed:", error.message);

    return res.status(400).json({
      success: false,
      message: "Invalid Stripe webhook signature",
    });
  }

  // 2. Ignore event types we don't process.
  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({
      received: true,
      message: "Event acknowledged",
    });
  }

  const checkoutSession = event.data.object;

  // 3. Only accept successfully paid Checkout Sessions.
  if (
    checkoutSession.payment_status !== "paid" ||
    checkoutSession.mode !== "payment"
  ) {
    return res.status(200).json({
      received: true,
      message: "Payment is not completed",
    });
  }

  const orderId = checkoutSession.metadata?.orderId;

  if (
    !orderId ||
    !mongoose.Types.ObjectId.isValid(orderId) ||
    checkoutSession.client_reference_id !== orderId
  ) {
    console.error("Stripe webhook contains invalid order reference:", event.id);

    return res.status(200).json({
      received: true,
      message: "Invalid order reference ignored",
    });
  }

  const mongoSession = await mongoose.startSession();

  try {
    await mongoSession.withTransaction(async () => {
      // 4. Prevent duplicate event processing.
      await StripeWebhookEvent.create(
        [
          {
            eventId: event.id,
            eventType: event.type,
            processingStatus: "processed",
            processedAt: new Date(),
          },
        ],
        { session: mongoSession },
      );

      // 5. Find the order associated with this Checkout Session.
      const order = await Order.findOne({
        _id: orderId,
        stripeCheckoutSessionId: checkoutSession.id,
        paymentMethod: "stripe",
      }).session(mongoSession);

      if (!order) {
        throw new Error(
          `No matching order found for Stripe session ${checkoutSession.id}`,
        );
      }

      // 6. Verify the amount and currency against the database order.
      const expectedAmount = Math.round(order.totalAmount * 100);

      if (
        checkoutSession.amount_total !== expectedAmount ||
        checkoutSession.currency !== "inr"
      ) {
        throw new Error(
          `Stripe payment amount mismatch for order ${order.orderNumber}`,
        );
      }

      // 7. Never overwrite an existing successful payment.
      if (order.paymentStatus === "paid") {
        return;
      }

      // 8. Never automatically pay a cancelled or failed order.
      if (
        order.orderStatus !== "pending" ||
        order.paymentStatus !== "pending"
      ) {
        console.error(
          "Payment received for an ineligible order:",
          order.orderNumber,
        );

        return;
      }

      // 9. Atomically mark the order as paid.
      const paymentIntentId =
        typeof checkoutSession.payment_intent === "string"
          ? checkoutSession.payment_intent
          : checkoutSession.payment_intent?.id;

      const updatedOrder = await Order.findOneAndUpdate(
        {
          _id: order._id,
          orderStatus: "pending",
          paymentStatus: "pending",
          stripeCheckoutSessionId: checkoutSession.id,
        },
        {
          $set: {
            paymentStatus: "paid",
            paymentId: paymentIntentId || checkoutSession.id,
            stripePaymentIntentId: paymentIntentId || null,
            paidAt: new Date(),
          },
        },
        {
          new: true,
          runValidators: true,
          session: mongoSession,
        },
      );

      if (!updatedOrder) {
        throw new Error(
          `Order payment state changed during processing: ${order.orderNumber}`,
        );
      }

      console.log(
        `Payment verified successfully for order ${updatedOrder.orderNumber}`,
      );
    });

    return res.status(200).json({
      received: true,
      message: "Webhook processed successfully",
    });
  } catch (error) {
    // A duplicate event is safe to acknowledge.
    if (error.code === 11000) {
      return res.status(200).json({
        received: true,
        message: "Duplicate webhook event ignored",
      });
    }

    console.error("Stripe webhook processing failed:", {
      eventId: event.id,
      message: error.message,
    });

    // A 500 response tells Stripe to retry the webhook.
    return res.status(500).json({
      received: false,
      message: "Webhook processing failed",
    });
  } finally {
    await mongoSession.endSession();
  }
};
