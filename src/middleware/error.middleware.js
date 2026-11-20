const errorHandler = (err, req, res, next) => {
  // If response has already started, delegate to Express
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || "Internal Server Error";

  // MongoDB duplicate key error
  if (err.code === 11000) {
    statusCode = 409;
    message = "A record with this information already exists";
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Invalid data provided";
  }

  // Mongoose invalid ObjectId error
  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid resource identifier";
  }

  // Hide unexpected internal errors in production
  if (statusCode >= 500 && process.env.NODE_ENV === "production") {
    message = "Internal Server Error";
  }

  // Log full error details on the server
  if (statusCode >= 500) {
    console.error("❌ Server Error:", err);
  }

  return res.status(statusCode).json({
    success: false,
    message,
  });
};

export default errorHandler;
