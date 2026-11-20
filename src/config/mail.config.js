import nodemailer from "nodemailer";

const requiredEnvVariables = [
  "BREVO_SMTP_HOST",
  "BREVO_SMTP_PORT",
  "BREVO_SMTP_USER",
  "BREVO_SMTP_KEY",
  "EMAIL_FROM",
  "EMAIL_FROM_NAME",
];

for (const variable of requiredEnvVariables) {
  if (!process.env[variable]) {
    throw new Error(`Missing required email environment variable: ${variable}`);
  }
}

const transporter = nodemailer.createTransport({
  host: process.env.BREVO_SMTP_HOST,
  port: Number(process.env.BREVO_SMTP_PORT),
  secure: false,
  requireTLS: true,

  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_KEY,
  },

  tls: {
    minVersion: "TLSv1.2",
  },
});

export default transporter;
