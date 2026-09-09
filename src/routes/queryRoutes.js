import express from "express";
import { verifyToken, authorize } from "../middlewares/authMiddleware.js";
import { raiseQuery, getMyQueries } from "../controller/queryController.js";

const router = express.Router();

router.post("/", verifyToken, authorize("CANDIDATE", "EMPLOYEE", "RECRUITER"), raiseQuery);
router.get("/my-queries", verifyToken, authorize("CANDIDATE", "EMPLOYEE", "RECRUITER"), getMyQueries);

export default router;