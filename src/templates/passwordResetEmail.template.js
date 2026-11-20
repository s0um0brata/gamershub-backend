
const passwordResetEmailTemplate = ({ name, resetUrl }) => {
  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const safeName = escapeHtml(name || "Gamer");

  let parsedResetUrl;

  try {
    parsedResetUrl = new URL(resetUrl);
  } catch {
    throw new Error("Invalid password reset URL.");
  }

  if (!["http:", "https:"].includes(parsedResetUrl.protocol)) {
    throw new Error("Password reset URL must use HTTP or HTTPS.");
  }

  const safeResetUrl = escapeHtml(parsedResetUrl.toString());

  return {
    subject: "Reset Your GamersHub Password",

    text: `Hello ${name || "Gamer"},

We received a request to reset your GamersHub account password.

Use the following link to reset your password:

${parsedResetUrl.toString()}

This link expires in 15 minutes and can only be used once.

If you did not request a password reset, you can safely ignore this email.

The GamersHub Team`,

    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta name="referrer" content="no-referrer" />
          <title>Reset Your Password</title>
        </head>

        <body style="margin:0; padding:0; background:#f4f4f5; font-family:Arial,sans-serif; color:#18181b;">
          <div style="max-width:600px; margin:30px auto; background:#ffffff; border-radius:12px; overflow:hidden;">

            <div style="background:#18181b; padding:30px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:28px;">
                PC GAMERS HUB
              </h1>
              <p style="color:#a1a1aa; margin:8px 0 0;">
                Account Security
              </p>
            </div>

            <div style="padding:35px 30px;">
              <h2>Hello, ${safeName}!</h2>

              <p style="font-size:15px; line-height:1.7; color:#52525b;">
                We received a request to reset your GamersHub account password.
                Click the button below to choose a new password.
              </p>

              <div style="text-align:center; margin:30px 0;">
                <a
                  href="${safeResetUrl}"
                  style="display:inline-block; padding:14px 28px; background:#2563eb; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:bold;"
                >
                  Reset My Password
                </a>
              </div>

              <p style="font-size:14px; line-height:1.7; color:#52525b;">
                This reset link expires in <strong>15 minutes</strong>
                and can only be used once.
              </p>

              <p style="font-size:14px; line-height:1.7; color:#71717a;">
                If you did not request a password reset, you can safely ignore this email.
                Your password will remain unchanged.
              </p>

              <p style="font-size:13px; color:#71717a; line-height:1.6;">
                If the button doesn't work, copy and paste this link into your browser:
                <br />
                <a href="${safeResetUrl}" style="color:#2563eb; word-break:break-all;">
                  ${safeResetUrl}
                </a>
              </p>

              <p style="margin-top:30px;">
                Regards,<br />
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

export default passwordResetEmailTemplate;
