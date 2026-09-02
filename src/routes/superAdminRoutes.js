import express from "express";
import { verifyToken, authorize } from "../middlewares/authMiddleware.js";
import { getPendingUsers, approveUser, rejectUser, getAllUsers } from "../controller/superAdminController.js";

const router = express.Router();


router.get("/pending-users", verifyToken, authorize("SUPER_ADMIN"), getPendingUsers);
router.patch("/users/:id/approve", verifyToken, authorize("SUPER_ADMIN"), approveUser);
router.patch("/users/:id/reject", verifyToken, authorize("SUPER_ADMIN"), rejectUser);
router.get("/users", verifyToken, authorize("SUPER_ADMIN"), getAllUsers);

export default router;