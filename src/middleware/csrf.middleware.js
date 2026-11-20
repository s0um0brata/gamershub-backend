import ApiError from "../utils/ApiError.js";

const allowedOrigin = new URL(
  process.env.FRONTEND_URL || "http://localhost:5173"
).origin;

const csrfProtection = (req, res, next) => {
  const origin = req.get("Origin");

  // Reject requests without an Origin header
  if (!origin) {
    return next(
      new ApiError(403, "Request origin is missing")
    );
  }

  // Verify the request origin
  if (origin !== allowedOrigin) {
    return next(
      new ApiError(403, "Invalid request origin")
    );
  }

  next();
};

export default csrfProtection;
