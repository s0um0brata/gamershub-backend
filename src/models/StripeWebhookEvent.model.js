import mongoose from "mongoose";

const stripeWebhookEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    eventType: {
      type: String,
      required: true,
      trim: true,
    },

    processingStatus: {
      type: String,
      enum: ["processed", "ignored"],
      default: "processed",
    },

    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

const StripeWebhookEvent = mongoose.model(
  "StripeWebhookEvent",
  stripeWebhookEventSchema,
);

export default StripeWebhookEvent;
