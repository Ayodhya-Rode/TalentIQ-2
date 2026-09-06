import express from "express";
import { verifyToken, authorize } from "../middlewares/authMiddleware.js";
import {
  employeeConfirmComplete,
  candidateConfirmComplete,
  cancelBooking,
  postponeBooking,
} from "../controller/interviewController.js";

const router = express.Router();

router.post(
  "/employee/bookings/:bookingId/confirm-complete",
  verifyToken,
  authorize("EMPLOYEE"),
  employeeConfirmComplete,
);
router.post(
  "/candidate/bookings/:bookingId/confirm-complete",
  verifyToken,
  authorize("CANDIDATE"),
  candidateConfirmComplete,
);
router.post(
  "/employee/bookings/:bookingId/cancel",
  verifyToken,
  authorize("EMPLOYEE"),
  cancelBooking,
);

router.post(
  "/employee/bookings/:bookingId/postpone",
  verifyToken,
  authorize("EMPLOYEE"),
  postponeBooking,
);
export default router;
