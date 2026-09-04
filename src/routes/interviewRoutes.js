import express from "express";
import { verifyToken, authorize } from "../middlewares/authMiddleware.js";
import { employeeConfirmComplete, candidateConfirmComplete } from "../controller/interviewController.js";

const router = express.Router();

router.post("/employee/bookings/:bookingId/confirm-complete", verifyToken, authorize("EMPLOYEE"), employeeConfirmComplete);
router.post("/candidate/bookings/:bookingId/confirm-complete", verifyToken, authorize("CANDIDATE"), candidateConfirmComplete);

export default router;