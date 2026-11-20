import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

const verifyJWT = asyncHandler(async (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(401, "Unauthorized request. Please login.");
  }

  const token = authHeader.split(" ")[1];

  // Verify JWT token
  let decodedToken;

  try {
    decodedToken = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new ApiError(401, "Invalid or expired access token");
  }

  // Find authenticated user
  const user = await User.findById(decodedToken._id);

  if (!user) {
    throw new ApiError(401, "User not found. Please login again.");
  }

  // Check whether the token has been revoked
  if (decodedToken.tokenVersion !== user.tokenVersion) {
    throw new ApiError(401, "Session expired. Please login again.");
  }

  // Attach safe user information to request
  const safeUser = user.toObject();

  delete safeUser.password;
  delete safeUser.tokenVersion;

  req.user = safeUser;

  next();
});

export default verifyJWT;
