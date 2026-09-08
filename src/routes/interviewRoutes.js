import express from "express";
import { verifyToken, authorize } from "../middlewares/authMiddleware.js";
import {
  employeeConfirmComplete,
  candidateConfirmComplete,
  cancelBooking,
  postponeBooking,
  candidateRebookSameEmployee,
  requestRefund,
  getInterviewJoinToken,
  submitFeedback
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

router.post(
  "/candidate/bookings/:bookingId/rebook-same-employee",
  verifyToken,
  authorize("CANDIDATE"),
  candidateRebookSameEmployee
);

router.post(
  "/candidate/bookings/:bookingId/request-refund",
  verifyToken,
  authorize("CANDIDATE"),
  requestRefund
);

router.get(
  "/bookings/:bookingId/join-token",
  verifyToken,
  authorize("EMPLOYEE", "CANDIDATE"),
  getInterviewJoinToken
);

router.post(
  "/employee/bookings/:bookingId/feedback",
  verifyToken,
  authorize("EMPLOYEE"),
  submitFeedback
);
export default router;
