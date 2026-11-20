import User from "../models/User.model.js";
import Game from "../models/Game.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

// Add Game to Cart
const addToCart = asyncHandler(async (req, res) => {
  const { gameId } = req.params;

  // Find only published games
  const game = await Game.findOne({
    _id: gameId,
    status: "published",
  }).select("_id");

  if (!game) {
    throw new ApiError(404, "Game not found or unavailable");
  }

  // Add game only if it is not already in cart
  const user = await User.findOneAndUpdate(
    {
      _id: req.user._id,
      cart: { $ne: game._id },
    },
    {
      $addToSet: { cart: game._id },
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

    throw new ApiError(409, "Game is already in your cart");
  }

  return res.status(200).json(
    new ApiResponse(200, "Game added to cart successfully", {
      gameId: game._id,
      cartCount: user.cart.length,
    }),
  );
});

// Remove Game from Cart
const removeFromCart = asyncHandler(async (req, res) => {
  const { gameId } = req.params;

  const user = await User.findOneAndUpdate(
    {
      _id: req.user._id,
      cart: gameId,
    },
    {
      $pull: { cart: gameId },
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

    throw new ApiError(404, "Game not found in your cart");
  }

  return res.status(200).json(
    new ApiResponse(200, "Game removed from cart successfully", {
      gameId,
      cartCount: user.cart.length,
    }),
  );
});

// Get Shopping Cart
const getCart = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select("cart")
    .populate({
      path: "cart",
      match: { status: "published" },
      select:
        "title slug shortDescription price discountPrice coverImage developer publisher genres categories platforms status",
      populate: {
        path: "categories",
        select: "name slug",
      },
    });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Exclude games that are no longer published
  const cartGames = user.cart.filter(Boolean);

  // Calculate prices using database values
  const subtotal = cartGames.reduce(
    (total, game) => total + Number(game.price),
    0,
  );

  const totalDiscount = cartGames.reduce((total, game) => {
    if (game.discountPrice !== null && game.discountPrice !== undefined) {
      return total + (Number(game.price) - Number(game.discountPrice));
    }

    return total;
  }, 0);

  const totalPayable = subtotal - totalDiscount;

  return res.status(200).json(
    new ApiResponse(200, "Cart fetched successfully", {
      cartCount: cartGames.length,
      subtotal,
      totalDiscount,
      totalPayable,
      cart: cartGames,
    }),
  );
});

// Clear Shopping Cart
const clearCart = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { cart: [] } },
    { new: true },
  ).select("cart");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res.status(200).json(
    new ApiResponse(200, "Cart cleared successfully", {
      cartCount: user.cart.length,
    }),
  );
});

export { addToCart, removeFromCart, getCart, clearCart };
