import crypto from "node:crypto";

// Generate a secure random refresh token
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString("hex");
};

// Hash refresh token using SHA-256
const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export {
  generateRefreshToken,
  hashToken,
};
