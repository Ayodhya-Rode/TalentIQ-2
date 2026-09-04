import express from "express";
import { verifyToken, authorize } from "../middlewares/authMiddleware.js";
import {
  createEmployeeProfile,
  getEmployeeProfile,
  updateEmployeeProfile,
  createSlot,
  getMySlots,
  updateSlot,
  deleteSlot,
  getMyBookings,
  getDashboardSummary,
} from "../controller/employeeController.js";

const router = express.Router();

router.post("/create-profile", verifyToken, authorize("EMPLOYEE"), createEmployeeProfile);
router.get("/get-profile", verifyToken, authorize("EMPLOYEE"), getEmployeeProfile);
router.put("/update-profile", verifyToken, authorize("EMPLOYEE"), updateEmployeeProfile);

router.post("/create-slot", verifyToken, authorize("EMPLOYEE"), createSlot);
router.get("/get-slots", verifyToken, authorize("EMPLOYEE"), getMySlots);
router.put("/update-slot/:id", verifyToken, authorize("EMPLOYEE"), updateSlot);
router.delete("/delete-slot/:id", verifyToken, authorize("EMPLOYEE"), deleteSlot);
router.get("/get-bookings", verifyToken, authorize("EMPLOYEE"), getMyBookings);
router.get("/dashboard", verifyToken, authorize("EMPLOYEE"), getDashboardSummary);
export default router;