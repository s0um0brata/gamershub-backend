import stripe from "../config/stripe.config.js";

const createCheckoutSession = async ({
  order,
  customerEmail,
  idempotencyKey,
}) => {
  if (!order || !order._id || !order.items?.length) {
    throw new Error("A valid order is required");
  }

  if (!customerEmail) {
    throw new Error("Customer email is required");
  }

  const frontendUrl = process.env.FRONTEND_URL?.replace(/\/+$/, "");

  if (!frontendUrl) {
    throw new Error("FRONTEND_URL is not configured");
  }

  const successUrl = `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&orderId=${encodeURIComponent(order._id.toString())}`;

  const cancelUrl = new URL("/payment/cancel", frontendUrl);
  cancelUrl.searchParams.set("orderId", order._id.toString());

  const lineItems = order.items.map((item) => ({
    price_data: {
      currency: "inr",
      product_data: {
        name: item.title,
        images: item.coverImage ? [item.coverImage] : [],
      },
      unit_amount: Math.round(item.finalPrice * 100),
    },
    quantity: 1,
  }));

  return stripe.checkout.sessions.create(
    {
      mode: "payment",
      // payment_method_types: ["card"],
      customer_email: customerEmail,
      client_reference_id: order._id.toString(),
      metadata: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
      },
      line_items: lineItems,
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
    },
    {
      idempotencyKey,
    },
  );
};

export { createCheckoutSession };
