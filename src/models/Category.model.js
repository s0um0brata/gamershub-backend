import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    // Category name
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      maxlength: 100,
    },

    // Unique category slug
    slug: {
      type: String,
      required: [true, "Category slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid category slug"],
    },

    // Category description
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    // Category visibility
    isActive: {
      type: Boolean,
      default: true,
    },

    // Admin who created the category
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
categorySchema.index({ isActive: 1, name: 1 });

const Category = mongoose.model("Category", categorySchema);

export default Category;
