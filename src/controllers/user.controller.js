import User from "../models/User.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import RefreshToken from "../models/RefreshToken.model.js";
import cloudinary from "../config/cloudinary.js";
import uploadToCloudinary from "../utils/cloudinaryUpload.js";

// Get Current User Profile
const getCurrentUser = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, "User profile fetched successfully", {
      user: req.user,
    }),
  );
});

// Update User Profile
const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, email, phoneNumber } = req.body;
  const profilePictureFile = req.file;

  if (
    fullName === undefined &&
    email === undefined &&
    phoneNumber === undefined &&
    !profilePictureFile
  ) {
    throw new ApiError(
      400,
      "Please provide at least one field or image to update",
    );
  }

  const updateData = {};

  if (fullName !== undefined) {
    updateData.fullName = fullName;
  }

  if (email !== undefined) {
    updateData.email = email.trim().toLowerCase();
  }

  if (phoneNumber !== undefined) {
    updateData.phoneNumber = phoneNumber.trim() || null;
  }

  // Check whether email is already used by another account
  if (updateData.email) {
    const existingUser = await User.findOne({
      email: updateData.email,
      _id: { $ne: req.user._id },
    });

    if (existingUser) {
      throw new ApiError(409, "Email is already in use");
    }
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  let newProfilePicturePublicId = null;
  const oldProfilePicturePublicId = user.profilePicturePublicId;

  try {
    // Upload new profile picture if provided
    if (profilePictureFile) {
      const uploadResult = await uploadToCloudinary(
        profilePictureFile.buffer,
        "pc-game-store/users",
      );

      newProfilePicturePublicId = uploadResult.publicId;

      updateData.profilePicture = uploadResult.url;
      updateData.profilePicturePublicId = uploadResult.publicId;
    }

    // Apply updates
    Object.assign(user, updateData);

    const updatedUser = await user.save();

    // Delete previous profile picture after successful database save
    if (
      newProfilePicturePublicId &&
      oldProfilePicturePublicId &&
      oldProfilePicturePublicId !== newProfilePicturePublicId
    ) {
      try {
        await cloudinary.uploader.destroy(oldProfilePicturePublicId, {
          resource_type: "image",
        });
      } catch (error) {
        console.error("Old profile picture cleanup failed:", error.message);
      }
    }

    const safeUser = updatedUser.toObject();
    delete safeUser.password;
    delete safeUser.tokenVersion;
    delete safeUser.profilePicturePublicId;

    return res.status(200).json(
      new ApiResponse(200, "Profile updated successfully", {
        user: safeUser,
      }),
    );
  } catch (error) {
    // Remove newly uploaded image if the database update fails
    if (newProfilePicturePublicId) {
      try {
        await cloudinary.uploader.destroy(newProfilePicturePublicId, {
          resource_type: "image",
        });
      } catch (cleanupError) {
        console.error(
          "New profile picture cleanup failed:",
          cleanupError.message,
        );
      }
    }

    throw error;
  }
});

// Change User Password
const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Current password is incorrect");
  }

  const isSamePassword = await user.isPasswordCorrect(newPassword);

  if (isSamePassword) {
    throw new ApiError(
      400,
      "New password must be different from current password",
    );
  }

  user.password = newPassword;
  user.tokenVersion += 1;

  await user.save();

  await RefreshToken.updateMany(
    {
      user: user._id,
      revokedAt: null,
    },
    {
      $set: { revokedAt: new Date() },
    },
  );

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
        "Password changed successfully. Please login again.",
      ),
    );
});

// Logout User
const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    $inc: { tokenVersion: 1 },
  });

  await RefreshToken.updateMany(
    {
      user: req.user._id,
      revokedAt: null,
    },
    {
      $set: { revokedAt: new Date() },
    },
  );

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "User logged out successfully"));
});

export { getCurrentUser, updateProfile, changePassword, logout };
