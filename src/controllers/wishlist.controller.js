import User from "../models/User.model.js";
import Game from "../models/Game.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

// Add Game to Wishlist
const addToWishlist = asyncHandler(async (req, res) => {
  const { gameId } = req.params;

  // Find only published games
  const game = await Game.findOne({
    _id: gameId,
    status: "published",
  }).select("_id");

  if (!game) {
    throw new ApiError(404, "Game not found or unavailable");
  }

  // Add game only if it is not already in wishlist
  const user = await User.findOneAndUpdate(
    {
      _id: req.user._id,
      wishlist: { $ne: game._id },
    },
    {
      $addToSet: { wishlist: game._id },
    },
    {
      new: true,
    },
  );

  if (!user) {
    const existingUser = await User.exists({ _id: req.user._id });

    if (!existingUser) {
      throw new ApiError(404, "User not found");
    }

    throw new ApiError(409, "Game is already in your wishlist");
  }

  return res.status(200).json(
    new ApiResponse(200, "Game added to wishlist successfully", {
      gameId: game._id,
      wishlistCount: user.wishlist.length,
    }),
  );
});

// Remove Game from Wishlist
const removeFromWishlist = asyncHandler(async (req, res) => {
  const { gameId } = req.params;

  const user = await User.findOneAndUpdate(
    {
      _id: req.user._id,
      wishlist: gameId,
    },
    {
      $pull: { wishlist: gameId },
    },
    {
      new: true,
    },
  );

  if (!user) {
    const existingUser = await User.exists({ _id: req.user._id });

    if (!existingUser) {
      throw new ApiError(404, "User not found");
    }

    throw new ApiError(404, "Game not found in your wishlist");
  }

  return res.status(200).json(
    new ApiResponse(200, "Game removed from wishlist successfully", {
      gameId,
      wishlistCount: user.wishlist.length,
    }),
  );
});

// Get User Wishlist
const getWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select("wishlist")
    .populate({
      path: "wishlist",
      match: { status: "published" },
      select:
        "title slug shortDescription price discountPrice coverImage developer publisher releaseDate genres categories platforms status",
      populate: {
        path: "categories",
        select: "name slug",
      },
    });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Exclude games that are no longer published
  const wishlistGames = user.wishlist.filter(Boolean);

  return res.status(200).json(
    new ApiResponse(200, "Wishlist fetched successfully", {
      wishlistCount: wishlistGames.length,
      wishlist: wishlistGames,
    }),
  );
});

export { addToWishlist, removeFromWishlist, getWishlist };
