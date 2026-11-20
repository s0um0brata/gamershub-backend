import "dotenv/config";

import { sendEmail } from "./src/services/email.service.js";
import orderCancellationEmailTemplate from "./src/templates/orderCancellationEmail.template.js";

try {
  const email = orderCancellationEmailTemplate({
    name: "Soumobrata",
    orderNumber: "GH-20261110-8274D9AA",
    items: [
      {
        title: "Elden Ring Test",
        finalPrice: 1499,
      },
    ],
    totalAmount: 1499,
  });

  const result = await sendEmail({
    to: process.env.EMAIL_FROM,
    ...email,
  });

  console.log("Order cancellation email sent successfully!");
  console.log("Message ID:", result.messageId);
} catch (error) {
  console.error("Order cancellation email test failed:", error.message);
  process.exitCode = 1;
}
