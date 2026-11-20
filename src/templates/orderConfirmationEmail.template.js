const orderConfirmationEmailTemplate = ({
  name,
  orderNumber,
  items = [],
  totalAmount,
  orderUrl,
}) => {
  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const safeName = escapeHtml(name || "Gamer");
  const safeOrderNumber = escapeHtml(orderNumber);

  if (!orderNumber) {
    throw new Error("Order number is required.");
  }

  if (!Array.isArray(items)) {
    throw new Error("Order items must be an array.");
  }

  const amount = Number(totalAmount);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Invalid order total amount.");
  }

  const formatCurrency = (value) => {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue < 0) {
      throw new Error("Invalid product price in order.");
    }

    return numericValue.toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
    });
  };

  const formattedAmount = formatCurrency(amount);

  const rawOrderUrl = orderUrl || process.env.FRONTEND_URL;

  let parsedOrderUrl;

  try {
    parsedOrderUrl = new URL(rawOrderUrl);
  } catch {
    throw new Error("Invalid order URL.");
  }

  if (!["http:", "https:"].includes(parsedOrderUrl.protocol)) {
    throw new Error("Order URL must use HTTP or HTTPS.");
  }

  const safeOrderUrl = escapeHtml(parsedOrderUrl.toString());

  const itemRows = items
    .map((item) => {
      const title = escapeHtml(item.title || "Game");
      const price = formatCurrency(item.finalPrice);

      return `
        <tr>
          <td style="padding:12px 8px; border-bottom:1px solid #e4e4e7;">
            ${title}
          </td>
          <td style="padding:12px 8px; border-bottom:1px solid #e4e4e7; text-align:right;">
            ${price}
          </td>
        </tr>
      `;
    })
    .join("");

  const textItems = items
    .map(
      (item) => `${item.title || "Game"} - ${formatCurrency(item.finalPrice)}`,
    )
    .join("\n");

  return {
    subject: `GamersHub Order Confirmation - ${orderNumber}`,

    text: `Hello ${name || "Gamer"},

Your GamersHub order has been created successfully.

Order Number: ${orderNumber}

${textItems}

Total Amount: ${formattedAmount}

Your order is awaiting payment.

View your order: ${parsedOrderUrl.toString()}

Happy Gaming!
The GamersHub Team`,

    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Order Confirmation</title>
        </head>

        <body style="margin:0; padding:0; background:#f4f4f5; font-family:Arial,sans-serif; color:#18181b;">
          <div style="max-width:600px; margin:30px auto; background:#ffffff; border-radius:12px; overflow:hidden;">

            <div style="background:#18181b; padding:30px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:28px;">
                PC GAMERS HUB
              </h1>
              <p style="color:#a1a1aa; margin:8px 0 0;">
                Order Confirmation
              </p>
            </div>

            <div style="padding:35px 30px;">
              <h2>Hello, ${safeName}!</h2>

              <p style="font-size:15px; line-height:1.7; color:#52525b;">
                Your order has been created successfully.
                Thank you for choosing GamersHub!
              </p>

              <div style="background:#f4f4f5; padding:18px; border-radius:8px; margin:25px 0;">
                <p style="margin:0 0 8px; color:#71717a; font-size:13px;">
                  ORDER NUMBER
                </p>
                <strong style="font-size:17px;">
                  ${safeOrderNumber}
                </strong>
              </div>

              <h3>Order Summary</h3>

              <table style="width:100%; border-collapse:collapse; font-size:14px;">
                <thead>
                  <tr>
                    <th style="text-align:left; padding:12px 8px; border-bottom:2px solid #e4e4e7;">
                      Game
                    </th>
                    <th style="text-align:right; padding:12px 8px; border-bottom:2px solid #e4e4e7;">
                      Price
                    </th>
                  </tr>
                </thead>

                <tbody>
                  ${itemRows}
                </tbody>
              </table>

              <div style="text-align:right; margin:25px 0;">
                <span style="color:#71717a;">Total Amount</span>
                <h2 style="margin:8px 0; color:#2563eb;">
                  ${formattedAmount}
                </h2>
              </div>

              <p style="font-size:14px; color:#71717a; line-height:1.6;">
                Your order is currently awaiting payment.
                This email confirms order creation, not successful payment.
              </p>

              <div style="text-align:center; margin:30px 0;">
                <a
                  href="${safeOrderUrl}"
                  style="display:inline-block; padding:14px 28px; background:#2563eb; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:bold;"
                >
                  View My Order
                </a>
              </div>

              <p style="margin-top:30px;">
                Happy Gaming!<br />
                <strong>The GamersHub Team</strong>
              </p>
            </div>

            <div style="background:#f4f4f5; padding:20px; text-align:center;">
              <p style="margin:0; font-size:12px; color:#71717a;">
                © ${new Date().getFullYear()} PC GamersHub. All rights reserved.
              </p>
            </div>

          </div>
        </body>
      </html>
    `,
  };
};

export default orderConfirmationEmailTemplate;
