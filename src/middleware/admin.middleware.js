import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

const verifyAdmin = asyncHandler(async (req, res, next) => {
  // Check whether the authenticated user is an admin
  if (req.user.role !== "admin") {
    throw new ApiError(
      403,
      "Access denied. Admin privileges required."
    );
  }

  next();
});

export default verifyAdmin;
