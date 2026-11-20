import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY environment variable");
}

if (!process.env.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
  throw new Error("Only Stripe Test Mode keys are allowed");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  appInfo: {
    name: "PC Game Store",
    version: "1.0.0",
  },
});

export default stripe;
