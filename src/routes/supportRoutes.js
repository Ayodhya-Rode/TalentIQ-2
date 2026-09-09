import express from "express";
import { verifyToken, authorize } from "../middlewares/authMiddleware.js";
import { getSupportDashboard, getQueries, resolveQuery } from "../controller/supportController.js";

const router = express.Router();

router.get("/dashboard", verifyToken, authorize("SUPPORT"), getSupportDashboard);
router.get("/queries", verifyToken, authorize("SUPPORT"), getQueries);
router.patch("/queries/:id/resolve", verifyToken, authorize("SUPPORT"), resolveQuery);

export default router;