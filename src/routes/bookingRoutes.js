import express from "express";
import { verifyToken, authorize } from "../middlewares/authMiddleware.js";
import {
  getEmployeesByCategory,
  createBookingOrder,
  verifyBookingPayment,
  getMyBookings,
  getEmployeeOpenSlots 
} from "../controller/bookingController.js";
import { getAiQuestions, generateAiQuestions } from "../controller/aiQuestionController.js";
import { toggleShare } from "../controller/scorecardController.js";

const router = express.Router();

router.get("/employees", verifyToken, authorize("CANDIDATE"), getEmployeesByCategory);
router.post("/create-order", verifyToken, authorize("CANDIDATE"), createBookingOrder);
router.post("/verify-payment", verifyToken, authorize("CANDIDATE"), verifyBookingPayment);
router.get("/my-bookings", verifyToken, authorize("CANDIDATE"), getMyBookings);

router.get("/employee/:employeeProfileId/slots", verifyToken, authorize("CANDIDATE"), getEmployeeOpenSlots);


router.get("/:bookingId/ai-questions", verifyToken, authorize("EMPLOYEE"),  getAiQuestions);
router.post("/:bookingId/ai-questions", verifyToken, authorize("EMPLOYEE"), generateAiQuestions);

router.patch("/:bookingId/share", verifyToken, authorize("CANDIDATE"),  toggleShare);
export default router;