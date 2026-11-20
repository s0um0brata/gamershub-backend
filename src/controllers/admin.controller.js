import Game from "../models/Game.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import cloudinary from "../config/cloudinary.js";
import uploadToCloudinary from "../utils/cloudinaryUpload.js";
import Category from "../models/Category.model.js";

// Delete uploaded Cloudinary images safely
const deleteCloudinaryImages = async (publicIds = []) => {
  const validIds = [...new Set(publicIds.filter(Boolean))];

  if (validIds.length === 0) {
    return {
      deleted: [],
      failed: [],
    };
  }

  const results = await Promise.allSettled(
    validIds.map((publicId) =>
      cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
      }),
    ),
  );

  const deleted = [];
  const failed = [];

  results.forEach((result, index) => {
    const publicId = validIds[index];

    if (
      result.status === "fulfilled" &&
      ["ok", "not found"].includes(result.value.result)
    ) {
      deleted.push(publicId);
    } else {
      failed.push(publicId);

      console.error(
        "Cloudinary cleanup failed:",
        publicId,
        result.status === "rejected"
          ? result.reason?.message
          : result.value?.result,
      );
    }
  });

  return { deleted, failed };
};

// Delete empty Cloudinary folders safely
const deleteCloudinaryFolders = async (publicIds = []) => {
  const folders = new Set();

  publicIds.filter(Boolean).forEach((publicId) => {
    const parts = publicId.split("/");

    // Remove the image filename to get its folder
    parts.pop();

    // Add the image folder
    if (parts.length > 0) {
      folders.add(parts.join("/"));
    }

    // Add its parent game folder
    if (parts.length > 0) {
      parts.pop();
      folders.add(parts.join("/"));
    }
  });

  const deleted = [];
  const failed = [];

  // Delete deepest folders first
  const sortedFolders = [...folders].sort(
    (a, b) => b.split("/").length - a.split("/").length,
  );

  for (const folder of sortedFolders) {
    try {
      await cloudinary.api.delete_folder(folder);
      deleted.push(folder);
    } catch (error) {
      failed.push(folder);

      console.error("Cloudinary folder cleanup failed:", folder, error.message);
    }
  }

  return { deleted, failed };
};

// Validate that all selected categories exist and are active
const validateActiveCategories = async (categoryIds) => {
  if (categoryIds === undefined) {
    return undefined;
  }

  const uniqueCategoryIds = [...new Set(categoryIds)];

  const activeCategories = await Category.find({
    _id: { $in: uniqueCategoryIds },
    isActive: true,
  }).select("_id");

  if (activeCategories.length !== uniqueCategoryIds.length) {
    throw new ApiError(
      400,
      "One or more selected categories are invalid or inactive",
    );
  }

  return uniqueCategoryIds;
};

// Admin Dashboard
const getAdminDashboard = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, "Welcome to the Admin Dashboard", {
      admin: req.user,
    }),
  );
});

// Get All Games for Admin
const getAdminGames = asyncHandler(async (req, res) => {
  const { status, search } = req.query;

  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
  );

  const filter = {};

  // Filter by game status when requested
  if (status) {
    const allowedStatuses = ["draft", "published", "archived"];

    if (!allowedStatuses.includes(status)) {
      throw new ApiError(400, "Invalid game status");
    }

    filter.status = status;
  }

  // Search by game title
  if (search?.trim()) {
    const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    filter.title = {
      $regex: escapedSearch,
      $options: "i",
    };
  }

  const skip = (page - 1) * limit;

  const [games, totalGames] = await Promise.all([
    Game.find(filter)
      .populate("categories")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),

    Game.countDocuments(filter),
  ]);

  return res.status(200).json(
    new ApiResponse(200, "Games retrieved successfully", {
      games,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalGames / limit),
        totalGames,
        limit,
      },
    }),
  );
});

// Get Single Game for Admin Editing
const getAdminGameById = asyncHandler(async (req, res) => {
  const { gameId } = req.params;

  const game = await Game.findById(gameId).populate("categories");

  if (!game) {
    throw new ApiError(404, "Game not found");
  }

  return res.status(200).json(
    new ApiResponse(200, "Game retrieved successfully", {
      game,
    }),
  );
});

// Create New Game
const createGame = asyncHandler(async (req, res) => {
  const {
    title,
    slug,
    description,
    shortDescription,
    price,
    discountPrice,
    developer,
    publisher,
    releaseDate,
    genres,
    categories,
    platforms,
    systemRequirements,
    isFeatured,
    status,
  } = req.body;

  // Get uploaded files from Multer
  const coverFile = req.files?.coverImage?.[0];
  const screenshotFiles = req.files?.screenshots || [];

  // Cover image is mandatory
  if (!coverFile) {
    throw new ApiError(400, "Game cover image is required");
  }

  // Maximum five screenshots
  if (screenshotFiles.length > 5) {
    throw new ApiError(400, "Maximum 5 screenshots are allowed");
  }

  // Validate selected categories before uploading images
  const validatedCategories = await validateActiveCategories(categories);

  // Check whether the game slug already exists
  const existingGame = await Game.findOne({ slug });

  if (existingGame) {
    throw new ApiError(409, "A game with this slug already exists");
  }

  const uploadedPublicIds = [];

  try {
    // Upload cover image
    const coverUpload = await uploadToCloudinary(
      coverFile.buffer,
      `pc-game-store/games/${slug}/cover`,
    );

    uploadedPublicIds.push(coverUpload.publicId);

    // Upload screenshots
    const uploadedScreenshots = [];

    for (const file of screenshotFiles) {
      const screenshotUpload = await uploadToCloudinary(
        file.buffer,
        `pc-game-store/games/${slug}/screenshots`,
      );

      uploadedPublicIds.push(screenshotUpload.publicId);

      uploadedScreenshots.push({
        url: screenshotUpload.url,
        publicId: screenshotUpload.publicId,
      });
    }

    // Create game in MongoDB
    const game = await Game.create({
      title,
      slug,
      description,
      shortDescription,
      price,
      discountPrice: discountPrice ?? null,

      coverImage: coverUpload.url,
      coverImagePublicId: coverUpload.publicId,

      screenshots: uploadedScreenshots.map((item) => item.url),
      screenshotPublicIds: uploadedScreenshots.map((item) => item.publicId),

      developer,
      publisher,
      releaseDate,
      genres,
      categories: validatedCategories ?? [],
      platforms,
      systemRequirements,
      isFeatured,
      status,
      createdBy: req.user._id,
    });

    return res.status(201).json(
      new ApiResponse(201, "Game created successfully", {
        game,
      }),
    );
  } catch (error) {
    // Remove newly uploaded images if game creation fails
    await deleteCloudinaryImages(uploadedPublicIds);

    throw error;
  }
});

// Update Existing Game
const updateGame = asyncHandler(async (req, res) => {
  const { gameId } = req.params;

  // Find existing game
  const game = await Game.findById(gameId);

  if (!game) {
    throw new ApiError(404, "Game not found");
  }

  // Uploaded files
  const coverFile = req.files?.coverImage?.[0];
  const screenshotFiles = req.files?.screenshots || [];

  if (screenshotFiles.length > 5) {
    throw new ApiError(400, "Maximum 5 new screenshots are allowed per update");
  }

  // Allowed text fields
  const allowedFields = [
    "title",
    "slug",
    "description",
    "shortDescription",
    "price",
    "discountPrice",
    "developer",
    "publisher",
    "releaseDate",
    "genres",
    "categories",
    "platforms",
    "systemRequirements",
    "isFeatured",
    "status",
  ];

  const updates = {};

  // Collect allowed fields from request body
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updates[field] = req.body[field];
    }
  }

  // Validate categories only when they are included in the update
  if (Object.prototype.hasOwnProperty.call(updates, "categories")) {
    updates.categories = await validateActiveCategories(updates.categories);
  }

  if (
    Object.keys(updates).length === 0 &&
    !coverFile &&
    screenshotFiles.length === 0
  ) {
    throw new ApiError(400, "No valid fields or images provided for update");
  }

  // Check final price and discount price
  const finalPrice = updates.price ?? game.price;

  const finalDiscountPrice = Object.prototype.hasOwnProperty.call(
    updates,
    "discountPrice",
  )
    ? updates.discountPrice
    : game.discountPrice;

  if (
    finalDiscountPrice !== null &&
    finalDiscountPrice !== undefined &&
    Number(finalDiscountPrice) >= Number(finalPrice)
  ) {
    throw new ApiError(400, "Discount price must be lower than regular price");
  }

  // Check whether another game already uses the updated slug
  if (updates.slug && updates.slug !== game.slug) {
    const existingGame = await Game.findOne({
      slug: updates.slug,
      _id: { $ne: gameId },
    });

    if (existingGame) {
      throw new ApiError(409, "A game with this slug already exists");
    }
  }

  const newlyUploadedPublicIds = [];
  let oldCoverPublicId = null;

  try {
    // Upload replacement cover image
    if (coverFile) {
      const coverUpload = await uploadToCloudinary(
        coverFile.buffer,
        `pc-game-store/games/${updates.slug || game.slug}/cover`,
      );

      newlyUploadedPublicIds.push(coverUpload.publicId);

      oldCoverPublicId = game.coverImagePublicId;

      updates.coverImage = coverUpload.url;
      updates.coverImagePublicId = coverUpload.publicId;
    }

    // Upload new screenshots and append them to existing screenshots
    if (screenshotFiles.length > 0) {
      const newScreenshotUrls = [];
      const newScreenshotPublicIds = [];

      for (const file of screenshotFiles) {
        const screenshotUpload = await uploadToCloudinary(
          file.buffer,
          `pc-game-store/games/${updates.slug || game.slug}/screenshots`,
        );

        newlyUploadedPublicIds.push(screenshotUpload.publicId);

        newScreenshotUrls.push(screenshotUpload.url);
        newScreenshotPublicIds.push(screenshotUpload.publicId);
      }

      // Preserve alignment for older records without public IDs
      const existingPublicIds = [...(game.screenshotPublicIds || [])];

      while (existingPublicIds.length < game.screenshots.length) {
        existingPublicIds.push(null);
      }

      updates.screenshots = [...game.screenshots, ...newScreenshotUrls];

      updates.screenshotPublicIds = [
        ...existingPublicIds,
        ...newScreenshotPublicIds,
      ];
    }

    // Apply updates and save
    Object.assign(game, updates);

    const updatedGame = await game.save();

    // Delete old cover only after successful database save
    if (oldCoverPublicId) {
      await deleteCloudinaryImages([oldCoverPublicId]);
    }

    return res.status(200).json(
      new ApiResponse(200, "Game updated successfully", {
        game: updatedGame,
      }),
    );
  } catch (error) {
    // Clean up new uploads if database update fails
    await deleteCloudinaryImages(newlyUploadedPublicIds);

    throw error;
  }
});

// Remove Individual Game Screenshot
const removeGameScreenshot = asyncHandler(async (req, res) => {
  const { gameId, index } = req.params;

  // Validate screenshot index
  const screenshotIndex = Number(index);

  if (!Number.isInteger(screenshotIndex) || screenshotIndex < 0) {
    throw new ApiError(400, "Invalid screenshot index");
  }

  // Find game
  const game = await Game.findById(gameId);

  if (!game) {
    throw new ApiError(404, "Game not found");
  }

  // Check whether screenshot exists
  if (screenshotIndex >= game.screenshots.length) {
    throw new ApiError(404, "Screenshot not found");
  }

  // Get screenshot URL and Cloudinary public ID
  const removedScreenshot = game.screenshots[screenshotIndex];

  const removedPublicId = game.screenshotPublicIds?.[screenshotIndex] || null;

  // Remove screenshot URL
  game.screenshots.splice(screenshotIndex, 1);

  // Keep public IDs aligned with screenshot URLs
  if (game.screenshotPublicIds?.length) {
    game.screenshotPublicIds.splice(screenshotIndex, 1);
  }

  // Save database changes first
  await game.save();

  // Delete image from Cloudinary after successful database save
  if (removedPublicId) {
    await deleteCloudinaryImages([removedPublicId]);
  }

  return res.status(200).json(
    new ApiResponse(200, "Screenshot removed successfully", {
      gameId: game._id,
      removedScreenshot,
      remainingScreenshots: game.screenshots.length,
    }),
  );
});

// Delete Game (Soft Delete)
const deleteGame = asyncHandler(async (req, res) => {
  const { gameId } = req.params;

  const game = await Game.findById(gameId);

  if (!game) {
    throw new ApiError(404, "Game not found");
  }

  if (game.status === "archived") {
    throw new ApiError(400, "Game is already archived");
  }

  game.status = "archived";

  await game.save();

  return res.status(200).json(
    new ApiResponse(200, "Game archived successfully", {
      gameId: game._id,
      status: game.status,
    }),
  );
});

// Permanently Delete Game and Its Cloudinary Images
const permanentlyDeleteGame = asyncHandler(async (req, res) => {
  const { gameId } = req.params;

  // Find game
  const game = await Game.findById(gameId);

  if (!game) {
    throw new ApiError(404, "Game not found");
  }

  // Collect all Cloudinary public IDs
  const imagePublicIds = [
    game.coverImagePublicId,
    ...(game.screenshotPublicIds || []),
  ].filter(Boolean);

  // Permanently delete game from MongoDB
  await Game.findByIdAndDelete(gameId);

  // Attempt to delete associated Cloudinary images
  const cleanupResult = await deleteCloudinaryImages(imagePublicIds);
  const folderCleanupResult = await deleteCloudinaryFolders(imagePublicIds);

  return res.status(200).json(
    new ApiResponse(
      200,
      cleanupResult.failed.length === 0
        ? "Game and associated images permanently deleted"
        : "Game deleted, but some Cloudinary images could not be removed",
      {
        gameId,
        databaseDeleted: true,
        imagesDeleted: cleanupResult.deleted.length,
        imagesFailed: cleanupResult.failed.length,
        failedPublicIds: cleanupResult.failed,
        foldersDeleted: folderCleanupResult.deleted.length,
        foldersFailed: folderCleanupResult.failed.length,
        failedFolders: folderCleanupResult.failed,
      },
    ),
  );
});

export {
  getAdminDashboard,
  createGame,
  updateGame,
  deleteGame,
  removeGameScreenshot,
  permanentlyDeleteGame,
  validateActiveCategories,
  getAdminGames,
  getAdminGameById,
};
