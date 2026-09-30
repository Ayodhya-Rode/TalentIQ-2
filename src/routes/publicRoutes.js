import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getPublicScorecard } from "../controller/scorecardController.js";

const router = Router();

// 60 requests per 15 min per IP: enough for real viewers, too slow for scraping or token guessing
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later" },
});

router.get("/scorecards/:token", publicLimiter, getPublicScorecard);

export default router;