import mongoose from "mongoose";

const gameSchema = new mongoose.Schema(
  {
    // Basic game information
    title: {
      type: String,
      required: [true, "Game title is required"],
      trim: true,
      maxlength: 150,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      required: [true, "Game description is required"],
    },

    shortDescription: {
      type: String,
      trim: true,
      maxlength: 300,
    },

    // Pricing
    price: {
      type: Number,
      required: [true, "Game price is required"],
      min: 0,
    },

    discountPrice: {
      type: Number,
      default: null,
      min: 0,
      validate: {
        validator: function (value) {
          return value === null || value < this.price;
        },
        message: "Discount price must be lower than regular price",
      },
    },

    // Game images
    coverImage: {
      type: String,
      required: [true, "Game cover image is required"],
    },

    coverImagePublicId: {
      type: String,
      default: null,
    },

    screenshots: {
      type: [String],
      default: [],
    },

    screenshotPublicIds: {
      type: [String],
      default: [],
    },

    // Game information
    developer: {
      type: String,
      trim: true,
    },

    publisher: {
      type: String,
      trim: true,
    },

    releaseDate: {
      type: Date,
    },

    genres: {
      type: [String],
      default: [],
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    platforms: {
      type: [String],
      default: ["PC"],
    },

    // System requirements
    systemRequirements: {
      minimum: {
        os: String,
        processor: String,
        memory: String,
        graphics: String,
        storage: String,
      },

      recommended: {
        os: String,
        processor: String,
        memory: String,
        graphics: String,
        storage: String,
      },
    },

    // Store visibility
    isFeatured: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },

    // Admin who created the game
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

// Search and filtering indexes
gameSchema.index({ title: "text", description: "text" });
gameSchema.index({ status: 1, createdAt: -1 });
gameSchema.index({ price: 1 });

const Game = mongoose.model("Game", gameSchema);

export default Game;
