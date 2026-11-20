const welcomeEmailTemplate = ({ name }) => {
  const safeName = String(name || "Gamer")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const frontendUrl = process.env.FRONTEND_URL?.replace(/\/+$/, "");

  if (!frontendUrl) {
    throw new Error("FRONTEND_URL is not configured.");
  }

  return {
    subject: "Welcome to GamersHub!",

    text: `Hello ${name || "Gamer"},

Welcome to GamersHub!

Your account has been successfully created. We're excited to have you join our gaming community.

Explore games, build your wishlist, and discover your next adventure.

Visit GamersHub: ${frontendUrl}

Happy Gaming!
The GamersHub Team`,

    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Welcome to GamersHub</title>
        </head>

        <body style="margin:0; padding:0; background:#f4f4f5; font-family:Arial,sans-serif; color:#18181b;">
          <div style="max-width:600px; margin:30px auto; background:#ffffff; border-radius:12px; overflow:hidden;">

            <div style="background:#18181b; padding:30px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:28px;">
                PC GAMERS HUB
              </h1>
              <p style="color:#a1a1aa; margin:8px 0 0;">
                Your Next Gaming Adventure Starts Here
              </p>
            </div>

            <div style="padding:35px 30px;">
              <h2 style="color:#18181b;">
                Welcome, ${safeName}!
              </h2>

              <p style="font-size:15px; line-height:1.7; color:#52525b;">
                Your GamersHub account has been successfully created.
                We're excited to have you join our gaming community.
              </p>

              <p style="font-size:15px; line-height:1.7; color:#52525b;">
                Explore games, build your wishlist, and discover
                your next gaming adventure.
              </p>

              <div style="text-align:center; margin:30px 0;">
                <a
                  href="${frontendUrl}"
                  style="display:inline-block; padding:14px 28px; background:#2563eb; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:bold;"
                >
                  Explore GamersHub
                </a>
              </div>

              <p style="font-size:14px; color:#71717a; line-height:1.6;">
                If you did not create this account, please contact our support team.
              </p>

              <p style="margin-top:30px; color:#18181b;">
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

export default welcomeEmailTemplate;
