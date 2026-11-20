import User from "../models/User.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import RefreshToken from "../models/RefreshToken.model.js";
import { generateRefreshToken, hashToken } from "../utils/token.utils.js";
import { sendEmail } from "../services/email.service.js";
import welcomeEmailTemplate from "../templates/welcomeEmail.template.js";
import passwordResetEmailTemplate from "../templates/passwordResetEmail.template.js";

// Registration Controller
const register = asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new ApiError(409, "User with this email already exists");
  }

  // Create new user
  const user = await User.create({
    fullName,
    email,
    password,
  });

  // Remove password from API response
  const createdUser = await User.findById(user._id).select(
    "-password -tokenVersion",
  );

  // Send welcome email without interrupting registration
  try {
    const welcomeEmail = welcomeEmailTemplate({
      name: createdUser.fullName,
    });

    await sendEmail({
      to: createdUser.email,
      ...welcomeEmail,
    });

    console.log(`Welcome email sent to ${createdUser.email}`);
  } catch (error) {
    console.error(
      `Welcome email failed for ${createdUser.email}:`,
      error.message,
    );
  }

  return res
    .status(201)
    .json(new ApiResponse(201, "User registered successfully", createdUser));
});

// Login Controller

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user by email
  const user = await User.findOne({
    email: email.trim().toLowerCase(),
  });

  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  // Verify password
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid email or password");
  }

  // Generate access token
  const accessToken = user.generateAccessToken();

  // Generate refresh token
  const refreshToken = generateRefreshToken();

  // Hash refresh token before storing it
  const tokenHash = hashToken(refreshToken);

  // Calculate refresh token expiration
  const refreshTokenDays = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 7);

  const expiresAt = new Date(
    Date.now() + refreshTokenDays * 24 * 60 * 60 * 1000,
  );

  // Save hashed refresh token in MongoDB
  await RefreshToken.create({
    user: user._id,
    tokenVersion: user.tokenVersion,
    tokenHash,
    expiresAt,
  });

  // Get safe user information
  const loggedInUser = await User.findById(user._id).select(
    "-password -tokenVersion",
  );

  // Store refresh token in an HttpOnly cookie
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: refreshTokenDays * 24 * 60 * 60 * 1000,
    path: "/",
  });

  // Return access token and user information
  return res.status(200).json(
    new ApiResponse(200, "User logged in successfully", {
      user: loggedInUser,
      accessToken,
    }),
  );
});

// Refresh Access Token

const refreshAccessToken = asyncHandler(async (req, res) => {
  // Read refresh token from HttpOnly cookie
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    throw new ApiError(401, "Refresh token is required");
  }

  // Hash the received refresh token
  const tokenHash = hashToken(refreshToken);

  // Atomically validate and revoke the old token
  const storedToken = await RefreshToken.findOneAndUpdate(
    {
      tokenHash,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    },
    {
      $set: { revokedAt: new Date() },
    },
    {
      new: true,
    },
  );

  if (!storedToken) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  // Find token owner
  const user = await User.findById(storedToken.user);

  if (!user) {
    throw new ApiError(401, "User not found. Please login again.");
  }

  // Check session version
  if (storedToken.tokenVersion !== user.tokenVersion) {
    throw new ApiError(401, "Session expired. Please login again.");
  }

  // Generate new access token
  const newAccessToken = user.generateAccessToken();

  // Generate new refresh token
  const newRefreshToken = generateRefreshToken();

  // Hash new refresh token
  const newTokenHash = hashToken(newRefreshToken);

  // Calculate expiration date
  const refreshTokenDays = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 7);

  const expiresAt = new Date(
    Date.now() + refreshTokenDays * 24 * 60 * 60 * 1000,
  );

  // Store new refresh token
  await RefreshToken.create({
    user: user._id,
    tokenVersion: user.tokenVersion,
    tokenHash: newTokenHash,
    expiresAt,
  });

  // Set rotated refresh token in HttpOnly cookie
  res.cookie("refreshToken", newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: refreshTokenDays * 24 * 60 * 60 * 1000,
    path: "/",
  });

  // Return only the new access token
  return res.status(200).json(
    new ApiResponse(200, "Access token refreshed successfully", {
      accessToken: newAccessToken,
    }),
  );
});

// Forgot Password Controller

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Always return the same response to prevent email enumeration.
  const successMessage =
    "If an account exists with this email, a password reset link will be sent.";

  // Find user using normalized email.
  const user = await User.findOne({
    email: email.trim().toLowerCase(),
  });

  // Do not reveal whether the account exists.
  if (!user) {
    return res.status(200).json(new ApiResponse(200, successMessage, null));
  }

  // Generate a cryptographically secure reset token.
  const resetToken = generateRefreshToken();

  // Store only the hashed token.
  const resetTokenHash = hashToken(resetToken);

  // Token expires after 15 minutes.
  const resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

  // Save reset token hash and expiration.
  user.passwordResetTokenHash = resetTokenHash;
  user.passwordResetExpiresAt = resetTokenExpiresAt;

  await user.save();

  // Construct frontend reset URL.
  const frontendUrl = process.env.FRONTEND_URL;

  if (!frontendUrl) {
    console.error("FRONTEND_URL is not configured.");

    // Clear the unused reset token.
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;

    await user.save();

    return res.status(200).json(new ApiResponse(200, successMessage, null));
  }

  let resetUrl;

  try {
    const normalizedFrontendUrl = frontendUrl.replace(/\/+$/, "");

    const resetUrlObject = new URL(`${normalizedFrontendUrl}/reset-password`);

    if (!["http:", "https:"].includes(resetUrlObject.protocol)) {
      throw new Error("Invalid frontend URL protocol.");
    }

    resetUrlObject.searchParams.set("token", resetToken);

    resetUrl = resetUrlObject.toString();
  } catch (error) {
    console.error("Password reset URL construction failed:", error.message);

    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;

    await user.save();

    return res.status(200).json(new ApiResponse(200, successMessage, null));
  }

  // Send password reset email.
  try {
    const resetEmail = passwordResetEmailTemplate({
      name: user.fullName,
      resetUrl,
    });

    await sendEmail({
      to: user.email,
      ...resetEmail,
    });

    console.log(`Password reset email sent to ${user.email}`);
  } catch (error) {
    console.error(
      `Password reset email failed for ${user.email}:`,
      error.message,
    );

    // Clear the unused token if email delivery fails.
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;

    await user.save();
  }

  return res.status(200).json(new ApiResponse(200, successMessage, null));
});

// Reset Password Controller
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  // Hash the received reset token
  const resetTokenHash = hashToken(token);

  // Find user with a matching, unexpired reset token
  const user = await User.findOne({
    passwordResetTokenHash: resetTokenHash,
    passwordResetExpiresAt: { $gt: new Date() },
  }).select("+passwordResetTokenHash +passwordResetExpiresAt");

  if (!user) {
    throw new ApiError(400, "Invalid or expired password reset token");
  }

  // Update password
  user.password = newPassword;

  // Clear reset token to prevent reuse
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;

  // Invalidate existing sessions
  user.tokenVersion += 1;

  await user.save();

  // Revoke all refresh tokens for this user
  await RefreshToken.updateMany(
    {
      user: user._id,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
      },
    },
  );

  // Clear refresh token cookie
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Password reset successfully. Please login again.",
        null,
      ),
    );
});

export { register, login, refreshAccessToken, forgotPassword, resetPassword };
