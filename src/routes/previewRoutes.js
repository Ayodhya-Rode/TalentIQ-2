import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getScorecardPreview } from "../controller/scorecardController.js";

const router = Router();

// Higher limit: after the Render rewrite, many visitors can share one IP
const previewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/:token", previewLimiter, getScorecardPreview);

export default router;