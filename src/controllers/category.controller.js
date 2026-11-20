import Category from "../models/Category.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

// Get All Categories (Admin)
const getAllCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find()
    .sort({ createdAt: -1 })
    .select("-__v");

  return res.status(200).json(
    new ApiResponse(200, "Categories fetched successfully", {
      totalCategories: categories.length,
      categories,
    }),
  );
});

// Create New Category
const createCategory = asyncHandler(async (req, res) => {
  const { name, slug, description, isActive } = req.body;

  // Check whether category slug already exists
  const existingCategory = await Category.findOne({ slug });

  if (existingCategory) {
    throw new ApiError(409, "A category with this slug already exists");
  }

  // Create category
  const category = await Category.create({
    name,
    slug,
    description,
    isActive,
    createdBy: req.user._id,
  });

  return res.status(201).json(
    new ApiResponse(201, "Category created successfully", {
      category,
    }),
  );
});

// Update Existing Category
const updateCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;

  // Find category
  const category = await Category.findById(categoryId);

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  // Allowed fields
  const allowedFields = ["name", "slug", "description", "isActive"];

  const updates = {};

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "No valid fields provided for update");
  }

  // Check duplicate slug
  if (updates.slug && updates.slug !== category.slug) {
    const existingCategory = await Category.findOne({
      slug: updates.slug,
      _id: { $ne: categoryId },
    });

    if (existingCategory) {
      throw new ApiError(409, "A category with this slug already exists");
    }
  }

  // Apply updates
  Object.assign(category, updates);

  const updatedCategory = await category.save();

  return res.status(200).json(
    new ApiResponse(200, "Category updated successfully", {
      category: updatedCategory,
    }),
  );
});

// Deactivate Category (Soft Delete)
const deactivateCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;

  const category = await Category.findById(categoryId);

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  if (!category.isActive) {
    throw new ApiError(400, "Category is already inactive");
  }

  category.isActive = false;

  await category.save();

  return res.status(200).json(
    new ApiResponse(200, "Category deactivated successfully", {
      categoryId: category._id,
      isActive: category.isActive,
    }),
  );
});


const getActiveCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true })
    .select("-createdBy -__v")
    .sort({ name: 1 });

  return res.status(200).json(
    new ApiResponse(
      200,
      "Active categories fetched successfully",
      categories
    )
  );
});


export { getAllCategories, createCategory, updateCategory, deactivateCategory, getActiveCategories };
