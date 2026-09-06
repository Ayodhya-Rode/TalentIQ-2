import express from "express";
import { verifyToken, authorize } from "../middlewares/authMiddleware.js";
import {
  getEmployeesByCategory,
  createBookingOrder,
  verifyBookingPayment,
  getMyBookings,
  getEmployeeOpenSlots 
} from "../controller/bookingController.js";

const router = express.Router();

router.get("/employees", verifyToken, authorize("CANDIDATE"), getEmployeesByCategory);
router.post("/create-order", verifyToken, authorize("CANDIDATE"), createBookingOrder);
router.post("/verify-payment", verifyToken, authorize("CANDIDATE"), verifyBookingPayment);
router.get("/my-bookings", verifyToken, authorize("CANDIDATE"), getMyBookings);

router.get("/employee/:employeeProfileId/slots", verifyToken, authorize("CANDIDATE"), getEmployeeOpenSlots);
export default router;