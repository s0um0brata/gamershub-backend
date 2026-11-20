import Review from "../models/Review.model.js";
import Game from "../models/Game.model.js";
import Order from "../models/Order.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

// Create Review
const createReview = asyncHandler(async (req, res) => {
  const { gameId } = req.params;
  const { rating, comment } = req.body;

  const game = await Game.findOne({
    _id: gameId,
    status: "published",
  });

  if (!game) {
    throw new ApiError(404, "Game not found");
  }

  // Verify that the customer has successfully purchased this game
  const hasPurchased = await Order.exists({
    user: req.user._id,
    paymentStatus: "paid",
    orderStatus: { $nin: ["cancelled", "failed"] },
    "items.game": gameId,
  });

  if (!hasPurchased) {
    throw new ApiError(403, "You must purchase this game before reviewing it");
  }

  // Prevent duplicate reviews
  const existingReview = await Review.findOne({
    user: req.user._id,
    game: gameId,
  });

  if (existingReview) {
    throw new ApiError(
      409,
      "You have already reviewed this game. Please update your existing review.",
    );
  }

  const review = await Review.create({
    user: req.user._id,
    game: gameId,
    rating,
    comment,
  });

  const populatedReview = await Review.findById(review._id).populate(
    "user",
    "fullName profilePicture",
  );

  return res.status(201).json(
    new ApiResponse(201, "Review submitted successfully", {
      review: populatedReview,
    }),
  );
});

// Get Reviews for a Game
const getGameReviews = asyncHandler(async (req, res) => {
  const { gameId } = req.params;

  const game = await Game.findOne({
    _id: gameId,
    status: "published",
  });

  if (!game) {
    throw new ApiError(404, "Game not found");
  }

  const reviews = await Review.find({ game: gameId })
    .populate("user", "fullName profilePicture")
    .sort({ createdAt: -1 });

  const ratingStats = await Review.aggregate([
    {
      $match: {
        game: game._id,
      },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  const stats = ratingStats[0] || {
    averageRating: 0,
    totalReviews: 0,
  };

  return res.status(200).json(
    new ApiResponse(200, "Game reviews fetched successfully", {
      reviews,
      averageRating: Number(stats.averageRating.toFixed(1)),
      totalReviews: stats.totalReviews,
    }),
  );
});

// Get Logged-in User's Reviews
const getMyReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({
    user: req.user._id,
  })
    .populate("game", "title slug coverImage")
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, "Your reviews fetched successfully", {
      reviews,
    }),
  );
});

// Update Own Review
const updateReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const { rating, comment } = req.body;

  const review = await Review.findOne({
    _id: reviewId,
    user: req.user._id,
  });

  if (!review) {
    throw new ApiError(404, "Review not found");
  }

  if (rating !== undefined) {
    review.rating = rating;
  }

  if (comment !== undefined) {
    review.comment = comment;
  }

  await review.save();

  const populatedReview = await Review.findById(review._id).populate(
    "user",
    "fullName profilePicture",
  );

  return res.status(200).json(
    new ApiResponse(200, "Review updated successfully", {
      review: populatedReview,
    }),
  );
});

// Delete Own Review
const deleteReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;

  const review = await Review.findOneAndDelete({
    _id: reviewId,
    user: req.user._id,
  });

  if (!review) {
    throw new ApiError(404, "Review not found");
  }

  return res.status(200).json(
    new ApiResponse(200, "Review deleted successfully", {
      reviewId,
    }),
  );
});

export {
  createReview,
  getGameReviews,
  getMyReviews,
  updateReview,
  deleteReview,
};
