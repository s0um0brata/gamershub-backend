import Game from "../models/Game.model.js";
import Category from "../models/Category.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

// Get All Published Games with Search, Filters, Pagination and Sorting
const getAllGames = asyncHandler(async (req, res) => {
  // Pagination
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));

  const skip = (page - 1) * limit;

  // Allowed sorting options
  const sortOptions = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    price_asc: { price: 1, createdAt: -1 },
    price_desc: { price: -1, createdAt: -1 },
    title_asc: { title: 1, createdAt: -1 },
    title_desc: { title: -1, createdAt: -1 },
  };

  // Select sorting option (default: newest)
  const sortBy = req.query.sort?.trim() || "newest";

  if (!Object.prototype.hasOwnProperty.call(sortOptions, sortBy)) {
    throw new ApiError(
      400,
      "Invalid sort option. Allowed options: newest, oldest, price_asc, price_desc, title_asc, title_desc",
    );
  }

  const sortOption = sortOptions[sortBy];

  // Build database query
  const query = {
    status: "published",
  };

  // Filter by category slug
  if (req.query.category?.trim()) {
    const category = await Category.findOne({
      slug: req.query.category.trim().toLowerCase(),
      isActive: true,
    }).select("_id");

    if (!category) {
      throw new ApiError(404, "Category not found");
    }

    query.categories = category._id;
  }

  // Search by title or description
  if (req.query.search?.trim()) {
    query.$text = {
      $search: req.query.search.trim(),
    };
  }

  // Filter by genre
  if (req.query.genre?.trim()) {
    query.genres = req.query.genre.trim();
  }

  // Filter by platform
  if (req.query.platform?.trim()) {
    query.platforms = req.query.platform.trim();
  }

  // Filter by price range
  const priceFilter = {};

  if (req.query.minPrice !== undefined) {
    const minPrice = Number(req.query.minPrice);

    if (!Number.isFinite(minPrice) || minPrice < 0) {
      throw new ApiError(400, "Invalid minimum price");
    }

    priceFilter.$gte = minPrice;
  }

  if (req.query.maxPrice !== undefined) {
    const maxPrice = Number(req.query.maxPrice);

    if (!Number.isFinite(maxPrice) || maxPrice < 0) {
      throw new ApiError(400, "Invalid maximum price");
    }

    priceFilter.$lte = maxPrice;
  }

  if (
    priceFilter.$gte !== undefined &&
    priceFilter.$lte !== undefined &&
    priceFilter.$gte > priceFilter.$lte
  ) {
    throw new ApiError(
      400,
      "Minimum price cannot be greater than maximum price",
    );
  }

  if (Object.keys(priceFilter).length > 0) {
    query.price = priceFilter;
  }

  // Fetch games and total count
  const [games, totalGames] = await Promise.all([
    Game.find(query)
      .populate("categories", "name slug description")
      .select("-createdBy -__v")
      .sort(sortOption)
      .skip(skip)
      .limit(limit),

    Game.countDocuments(query),
  ]);

  // Pagination information
  const totalPages = Math.ceil(totalGames / limit);

  return res.status(200).json(
    new ApiResponse(200, "Games fetched successfully", {
      pagination: {
        currentPage: page,
        totalPages,
        totalGames,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      sorting: {
        sortBy,
      },
      games,
    }),
  );
});

// Get Featured Published Games
const getFeaturedGames = asyncHandler(async (req, res) => {
  // Limit the number of games returned
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 8));

  // Find featured and published games
  const [games, totalFeaturedGames] = await Promise.all([
    Game.find({
      status: "published",
      isFeatured: true,
    })
      .populate("categories", "name slug description")
      .select("-createdBy -__v")
      .sort({ createdAt: -1 })
      .limit(limit),

    Game.countDocuments({
      status: "published",
      isFeatured: true,
    }),
  ]);

  return res.status(200).json(
    new ApiResponse(200, "Featured games fetched successfully", {
      totalFeaturedGames,
      returnedGames: games.length,
      games,
    }),
  );
});

// Get Single Published Game by Slug
const getGameBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  // Find only published games
  const game = await Game.findOne({
    slug: slug.toLowerCase().trim(),
    status: "published",
  })
    .populate("categories", "name slug description")
    .select("-createdBy -__v");

  // Return 404 if game does not exist or is not published
  if (!game) {
    throw new ApiError(404, "Game not found");
  }

  return res.status(200).json(
    new ApiResponse(200, "Game details fetched successfully", {
      game,
    }),
  );
});

export { getAllGames, getFeaturedGames, getGameBySlug };
