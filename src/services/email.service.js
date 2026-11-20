import transporter from "../config/mail.config.js";

const sendEmail = async ({ to, subject, html, text }) => {
  if (!to || !subject || (!html && !text)) {
    throw new Error("Recipient, subject, and email content are required.");
  }

  try {
    const info = await transporter.sendMail({
      from: {
        name: process.env.EMAIL_FROM_NAME,
        address: process.env.EMAIL_FROM,
      },
      to,
      subject,
      text,
      html,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("Email sending failed:", {
      message: error.message,
      code: error.code,
      responseCode: error.responseCode,
    });

    throw new Error("Unable to send email. Please try again later.");
  }
};

export { sendEmail };
