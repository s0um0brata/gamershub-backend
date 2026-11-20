import express from "express";
import {
  getAllGames,
  getFeaturedGames,
  getGameBySlug,
} from "../../controllers/game.controller.js";

const router = express.Router();

// Get featured games
router.get("/featured", getFeaturedGames);

// Get single game details by slug
router.get("/:slug", getGameBySlug);

// Get all published games
router.get("/", getAllGames);

export default router;
