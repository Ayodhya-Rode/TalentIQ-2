import express from "express";
import { verifyToken, authorize } from "../middlewares/authMiddleware.js";
import { getPendingUsers, approveUser, rejectUser, getAllUsers, getDashboardSummary, getCancellationWarnings, createSupportUser } from "../controller/superAdminController.js";

const router = express.Router();

router.post("/create-support", verifyToken, authorize("SUPER_ADMIN"), createSupportUser);
router.get("/pending-users", verifyToken, authorize("SUPER_ADMIN"), getPendingUsers);
router.patch("/users/:id/approve", verifyToken, authorize("SUPER_ADMIN"), approveUser);
router.patch("/users/:id/reject", verifyToken, authorize("SUPER_ADMIN"), rejectUser);
router.get("/users", verifyToken, authorize("SUPER_ADMIN"), getAllUsers);
router.get("/dashboard", verifyToken, authorize("SUPER_ADMIN"), getDashboardSummary);
router.get("/cancellation-warnings", verifyToken, authorize("SUPER_ADMIN"), getCancellationWarnings);
export default router;