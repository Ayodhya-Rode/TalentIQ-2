import prisma from "../config/db.js";
import razorpay from "../config/razorpay.js";
import {
  notifyCancellation,
  notifyCancellationLimitReached,
  notifyPostponement 
} from "../utils/notifications.js";

/**
 * Employee confirms interview completion
 * @desc To allow employees to confirm that the interview has been completed.
 *       If both employee and candidate confirm, the booking is marked as COMPLETED.
 * @route POST /api/employee/bookings/:bookingId/confirm-complete
 * @access Private (Employee)
 */
export const employeeConfirmComplete = async (req, res) => {
  try {
    const { bookingId } = req.params;

    // 1. Find employee profile
    const employeeProfile = await prisma.employeeProfile.findUnique({
      where: {
        userId: req.user.userId,
      },
    });

    if (!employeeProfile) {
      return res.status(404).json({
        success: false,
        message: "Employee profile not found",
      });
    }

    // 2. Find booking
    const booking = await prisma.booking.findUnique({
      where: {
        id: bookingId,
      },
    });

    if (!booking || booking.employeeProfileId !== employeeProfile.id) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // 3. Booking must be CONFIRMED
    if (booking.status !== "CONFIRMED") {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm completion on a booking with status ${booking.status}`,
      });
    }

    // 3.5 Interview must have actually started
    const slot = await prisma.slot.findUnique({
      where: { id: booking.slotId },
    });

    if (!slot || new Date() < slot.startTime) {
      return res.status(400).json({
        success: false,
        message:
          "You can only confirm completion after the interview start time",
      });
    }

    // 3.6 Confirmation window must not have expired
    const CONFIRM_WINDOW_HOURS = 24;
    const confirmDeadline = new Date(
      slot.endTime.getTime() + CONFIRM_WINDOW_HOURS * 60 * 60 * 1000,
    );

    if (new Date() > confirmDeadline) {
      return res.status(400).json({
        success: false,
        message: "The window to confirm this interview has expired",
      });
    }

    // 4. Prevent duplicate confirmation
    if (booking.employeeConfirmedAt) {
      return res.status(400).json({
        success: false,
        message: "Employee has already confirmed completion",
      });
    }

    // 5. Save employee confirmation
    const updated = await prisma.booking.update({
      where: {
        id: bookingId,
      },

      data: {
        employeeConfirmedAt: new Date(),
      },
    });

    // 6. If candidate already confirmed,
    //    mark booking COMPLETED
    if (updated.candidateConfirmedAt) {
      const completedBooking = await prisma.booking.update({
        where: {
          id: bookingId,
        },

        data: {
          status: "COMPLETED",
          payoutStatus: "PENDING",
        },
      });

      return res.status(200).json({
        success: true,
        message: "Interview marked complete. Payout pending.",
        data: completedBooking,
      });
    }

    // 7. Candidate hasn't confirmed yet
    return res.status(200).json({
      success: true,
      message: "Confirmed. Waiting for candidate to confirm too.",
      data: updated,
    });
  } catch (err) {
    console.error("Employee confirm complete error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to confirm completion",
      error: err.message,
    });
  }
};

/**
 * Candidate confirms interview completion
 * @desc To allow candidates to confirm that the interview has been completed.
 *       If both employee and candidate confirm, the booking is marked as COMPLETED.
 * @route POST /api/candidate/bookings/:bookingId/confirm-complete
 * @access Private (Candidate)
 */
export const candidateConfirmComplete = async (req, res) => {
  try {
    const { bookingId } = req.params;

    // 1. Find candidate profile
    const candidateProfile = await prisma.candidateProfile.findUnique({
      where: {
        userId: req.user.userId,
      },
    });

    if (!candidateProfile) {
      return res.status(404).json({
        success: false,
        message: "Candidate profile not found",
      });
    }

    // 2. Find booking
    const booking = await prisma.booking.findUnique({
      where: {
        id: bookingId,
      },
    });

    if (!booking || booking.candidateProfileId !== candidateProfile.id) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // 3. Booking must be CONFIRMED
    if (booking.status !== "CONFIRMED") {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm completion on a booking with status ${booking.status}`,
      });
    }

    // 3.5 Interview must have actually started
    const slot = await prisma.slot.findUnique({
      where: { id: booking.slotId },
    });

    if (!slot || new Date() < slot.startTime) {
      return res.status(400).json({
        success: false,
        message:
          "You can only confirm completion after the interview start time",
      });
    }

    // 3.6 Confirmation window must not have expired
    const CONFIRM_WINDOW_HOURS = 24;
    const confirmDeadline = new Date(
      slot.endTime.getTime() + CONFIRM_WINDOW_HOURS * 60 * 60 * 1000,
    );

    if (new Date() > confirmDeadline) {
      return res.status(400).json({
        success: false,
        message: "The window to confirm this interview has expired",
      });
    }

    // 4. Prevent duplicate confirmation
    if (booking.candidateConfirmedAt) {
      return res.status(400).json({
        success: false,
        message: "Candidate has already confirmed completion",
      });
    }

    // 5. Save candidate confirmation
    const updated = await prisma.booking.update({
      where: {
        id: bookingId,
      },

      data: {
        candidateConfirmedAt: new Date(),
      },
    });

    // 6. If employee already confirmed,
    //    mark booking COMPLETED
    if (updated.employeeConfirmedAt) {
      const completedBooking = await prisma.booking.update({
        where: {
          id: bookingId,
        },

        data: {
          status: "COMPLETED",
          payoutStatus: "PENDING",
        },
      });

      return res.status(200).json({
        success: true,
        message: "Interview marked complete. Payout pending.",
        data: completedBooking,
      });
    }

    // 7. Employee hasn't confirmed yet
    return res.status(200).json({
      success: true,
      message: "Confirmed. Waiting for employee to confirm too.",
      data: updated,
    });
  } catch (err) {
    console.error("Candidate confirm complete error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to confirm completion",
      error: err.message,
    });
  }
};

const MAX_CANCEL_POSTPONE_PER_MONTH = 3;

/**
 * Get the count of cancellations and postponements for the current month for a given employee profile.
 * @desc This function counts the number of cancellation and postponement actions taken by an employee in the current month.
 * @route GET /api/employee/cancellation-count
 * @access Private (Employee)
 */
const getMonthlyCancellationCount = async (tx, employeeProfileId) => {
  const now = new Date();

  const startOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
    0,
    0,
    0,
    0,
  );

  const startOfNextMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1,
    0,
    0,
    0,
    0,
  );

  return tx.cancellationLog.count({
    where: {
      employeeProfileId,
      createdAt: {
        gte: startOfMonth,
        lt: startOfNextMonth,
      },
    },
  });
};

/**
 * Checks if the employee has reached the monthly cancellation and postponement limit.
 * @desc This function verifies if the number of cancellation and postponement actions taken by an employee in the current month exceeds the allowed limit.
 * @route GET /api/employee/check-monthly-limit
 * @access Private (Employee)
 */
const checkMonthlyLimit = async (tx, employeeProfileId) => {
  const count = await getMonthlyCancellationCount(tx, employeeProfileId);

  if (count >= MAX_CANCEL_POSTPONE_PER_MONTH) {
    const error = new Error("MONTHLY_LIMIT_REACHED");
    error.currentCount = count;
    throw error;
  }

  return count;
};

/**
 * Employee cancels a booking
 * @desc This function allows an employee to cancel a booking. It checks the employee's monthly cancellation limit, updates the booking and slot status, and logs the cancellation.
 * @route POST /api/employee/bookings/:bookingId/cancel
 * @access Private (Employee)
 */
export const cancelBooking = async (req, res) => {
  let employeeProfile;

  try {
    const { bookingId } = req.params;
    const { reason } = req.body;

    // --------------------------------------------------------
    // Find employee profile
    // --------------------------------------------------------

    employeeProfile = await prisma.employeeProfile.findUnique({
      where: {
        userId: req.user.userId,
      },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    if (!employeeProfile) {
      return res.status(404).json({
        success: false,
        message: "Employee profile not found",
      });
    }

    // --------------------------------------------------------
    // Validate cancellation reason
    // --------------------------------------------------------

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Cancellation reason is required",
      });
    }

    // --------------------------------------------------------
    // Find booking
    // --------------------------------------------------------

    const booking = await prisma.booking.findUnique({
      where: {
        id: bookingId,
      },
    });

    if (!booking || booking.employeeProfileId !== employeeProfile.id) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // --------------------------------------------------------
    // Validate booking status
    // --------------------------------------------------------

    if (booking.status !== "CONFIRMED") {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a booking with status ${booking.status}`,
      });
    }

    // --------------------------------------------------------
    // Transaction
    // --------------------------------------------------------

    await prisma.$transaction(async (tx) => {
      await checkMonthlyLimit(tx, employeeProfile.id);

      await tx.slot.update({
        where: { id: booking.slotId },
        data: { status: "CANCELLED" },
      });

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "CANCELLED",
          refundStatus: "PENDING",
          cancelReason: reason.trim(),
        },
      });

      await tx.cancellationLog.create({
        data: {
          employeeProfileId: employeeProfile.id,
          bookingId: booking.id,
          type: "CANCEL",
        },
      });
    });

    // --------------------------------------------------------
    // Notify candidate
    // --------------------------------------------------------

    const candidateForNotification = await prisma.candidateProfile.findUnique({
      where: { id: booking.candidateProfileId },
      include: { user: { select: { name: true, email: true } } },
    });

    if (candidateForNotification) {
      await notifyCancellation({
        candidateEmail: candidateForNotification.user.email,
        candidateName: candidateForNotification.user.name,
        employeeName: employeeProfile.user.name,
        reason: reason.trim(),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking cancelled. Refund marked pending.",
    });
  } catch (err) {
    if (err.message === "MONTHLY_LIMIT_REACHED") {
      console.warn(
        `Employee ${req.user.userId} hit the monthly cancel/postpone limit (attempted a 4th action). Super Admin should review.`,
      );

      if (employeeProfile?.user) {
        await notifyCancellationLimitReached({
          employeeEmail: employeeProfile.user.email,
          employeeName: employeeProfile.user.name,
          limit: MAX_CANCEL_POSTPONE_PER_MONTH,
        });
      }

      return res.status(429).json({
        success: false,
        message: `Monthly cancel/postpone limit of ${MAX_CANCEL_POSTPONE_PER_MONTH} has been reached.`,
        limit: MAX_CANCEL_POSTPONE_PER_MONTH,
        used: err.currentCount,
      });
    }

    console.error("Cancel booking error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel booking",
    });
  }
};

/**
 * Employee postpones a booking to a new slot
 * @desc This function allows an employee to postpone a booking to a new slot. It checks the employee's monthly cancellation limit, validates the new slot, updates the booking and slot statuses, and logs the postponement.
 * @route POST /api/employee/bookings/:bookingId/postpone
 * @access Private (Employee)
 */
export const postponeBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { newSlotId } = req.body;

    // --------------------------------------------------------
    // Validate new slot
    // --------------------------------------------------------

    if (!newSlotId) {
      return res.status(400).json({
        success: false,
        message: "newSlotId is required",
      });
    }

    // --------------------------------------------------------
    // Find employee profile
    // --------------------------------------------------------

    const employeeProfile = await prisma.employeeProfile.findUnique({
      where: {
        userId: req.user.userId,
      },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    if (!employeeProfile) {
      return res.status(404).json({
        success: false,
        message: "Employee profile not found",
      });
    }

    // --------------------------------------------------------
    // Find booking
    // --------------------------------------------------------

    const booking = await prisma.booking.findUnique({
      where: {
        id: bookingId,
      },
    });

    if (!booking || booking.employeeProfileId !== employeeProfile.id) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // --------------------------------------------------------
    // Validate booking status
    // --------------------------------------------------------

    if (booking.status !== "CONFIRMED") {
      return res.status(400).json({
        success: false,
        message: `Cannot postpone a booking with status ${booking.status}`,
      });
    }

    // --------------------------------------------------------
    // Cannot postpone to same slot
    // --------------------------------------------------------

    if (booking.slotId === newSlotId) {
      return res.status(400).json({
        success: false,
        message: "New slot must be different from the current slot",
      });
    }

    // --------------------------------------------------------
    // Find new slot
    // --------------------------------------------------------

    const newSlot = await prisma.slot.findUnique({
      where: {
        id: newSlotId,
      },
    });

    if (!newSlot || newSlot.employeeProfileId !== employeeProfile.id) {
      return res.status(404).json({
        success: false,
        message: "New slot not found",
      });
    }

    // --------------------------------------------------------
    // Validate new slot status
    // --------------------------------------------------------

    if (newSlot.status !== "OPEN") {
      return res.status(409).json({
        success: false,
        message: "New slot is not available",
      });
    }

    // --------------------------------------------------------
    // Validate new slot time
    // --------------------------------------------------------

    const now = new Date();

    if (newSlot.startTime <= now) {
      return res.status(400).json({
        success: false,
        message: "Cannot postpone to a slot in the past",
      });
    }

    // --------------------------------------------------------
    // Transaction
    // --------------------------------------------------------

    await prisma.$transaction(async (tx) => {
      // Check monthly limit BEFORE making the change
      await checkMonthlyLimit(tx, employeeProfile.id);

      // Lock the new slot
      const lockResult = await tx.slot.updateMany({
        where: {
          id: newSlot.id,
          status: "OPEN",
        },
        data: {
          status: "BOOKED",
        },
      });

      // Another request may have booked the slot
      if (lockResult.count === 0) {
        const error = new Error("SLOT_TAKEN");
        throw error;
      }

      // Release/cancel old slot
      await tx.slot.update({
        where: {
          id: booking.slotId,
        },
        data: {
          status: "CANCELLED",
        },
      });

      // Move booking to new slot
      await tx.booking.update({
        where: {
          id: booking.id,
        },
        data: {
          slotId: newSlot.id,
        },
      });

      // Log postpone
      await tx.cancellationLog.create({
        data: {
          employeeProfileId: employeeProfile.id,
          bookingId: booking.id,
          type: "POSTPONE",
        },
      });
    });

     // To send postpone notification to candidate
    const candidateForNotification = await prisma.candidateProfile.findUnique({
      where: { id: booking.candidateProfileId },
      include: { user: { select: { name: true, email: true } } },
    });

    if (candidateForNotification) {
      await notifyPostponement({
        candidateEmail: candidateForNotification.user.email,
        candidateName: candidateForNotification.user.name,
        employeeName: employeeProfile.user.name,
        newSlot,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking postponed to new slot successfully",
    });
  } catch (err) {
    // --------------------------------------------------------
    // New slot was taken by another request
    // --------------------------------------------------------

    if (err.message === "SLOT_TAKEN") {
      return res.status(409).json({
        success: false,
        message: "New slot was just taken by someone else",
      });
    }

    // --------------------------------------------------------
    // Monthly limit reached
    // --------------------------------------------------------

    if (err.message === "MONTHLY_LIMIT_REACHED") {
      console.warn(
        `Employee ${req.user.userId} hit the monthly cancel/postpone limit (attempted a 4th action). Super Admin should review.`,
      );

      // Visible in the Super Admin dashboard's "Cancellation Warnings" tab,
      // and the employee gets an automatic warning email.
      if (employeeProfile?.user) {
        await notifyCancellationLimitReached({
          employeeEmail: employeeProfile.user.email,
          employeeName: employeeProfile.user.name,
          limit: MAX_CANCEL_POSTPONE_PER_MONTH,
        });
      }

      return res.status(429).json({
        success: false,
        message: `Monthly cancel/postpone limit of ${MAX_CANCEL_POSTPONE_PER_MONTH} has been reached.`,
        limit: MAX_CANCEL_POSTPONE_PER_MONTH,
        used: err.currentCount,
      });
    }

    console.error("Postpone booking error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to postpone booking",
    });
  }
};

/**
 * Candidate rebooks the same employee for a different slot (after employee cancel)
 * @desc This function allows a candidate to rebook a slot with the same employee for a different time slot, reusing the already-paid amount.
 * @route POST /api/candidate/bookings/:bookingId/rebook
 * @access Private (Candidate)
 */
export const candidateRebookSameEmployee = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { newSlotId } = req.body;

    if (!newSlotId) {
      return res
        .status(400)
        .json({ success: false, message: "newSlotId is required" });
    }

    const candidateProfile = await prisma.candidateProfile.findUnique({
      where: { userId: req.user.userId },
    });

    if (!candidateProfile) {
      return res
        .status(404)
        .json({ success: false, message: "Candidate profile not found" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking || booking.candidateProfileId !== candidateProfile.id) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    if (booking.status !== "CANCELLED" || booking.refundStatus !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "This booking is not eligible for rebooking",
      });
    }

    const newSlot = await prisma.slot.findUnique({ where: { id: newSlotId } });

    if (!newSlot || newSlot.employeeProfileId !== booking.employeeProfileId) {
      return res.status(404).json({
        success: false,
        message: "New slot must belong to the same employee",
      });
    }

    if (newSlot.status !== "OPEN") {
      return res
        .status(409)
        .json({ success: false, message: "New slot is not available" });
    }

    if (newSlot.startTime < new Date()) {
      return res
        .status(400)
        .json({ success: false, message: "Cannot rebook a slot in the past" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const lockResult = await tx.slot.updateMany({
        where: { id: newSlot.id, status: "OPEN" },
        data: { status: "BOOKED" },
      });

      if (lockResult.count === 0) {
        throw new Error("SLOT_TAKEN");
      }

      return tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "CONFIRMED",
          slotId: newSlot.id,
          refundStatus: "NONE",
          employeeConfirmedAt: null,
          candidateConfirmedAt: null,
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: "Rebooked successfully using your existing payment",
      data: updated,
    });
  } catch (err) {
    if (err.message === "SLOT_TAKEN") {
      return res
        .status(409)
        .json({
          success: false,
          message: "That slot was just taken by someone else",
        });
    }
    console.error("Candidate rebook error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to rebook",
      error: err.message,
    });
  }
};

/**
 * Candidate requests a refund for a cancelled booking
 * @desc This function allows a candidate to request a refund for a booking that has been cancelled by the employee. It checks the booking status and processes the refund through Razorpay.
 * @route POST /api/candidate/bookings/:bookingId/request-refund
 * @access Private (Candidate)
 */
export const requestRefund = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const candidateProfile = await prisma.candidateProfile.findUnique({
      where: { userId: req.user.userId },
    });

    if (!candidateProfile) {
      return res
        .status(404)
        .json({ success: false, message: "Candidate profile not found" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking || booking.candidateProfileId !== candidateProfile.id) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    if (
      booking.status !== "CANCELLED" ||
      !["PENDING", "FAILED"].includes(booking.refundStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "This booking is not eligible for a refund",
      });
    }

    if (!booking.razorpayPaymentId) {
      return res.status(400).json({
        success: false,
        message: "No payment record found for this booking",
      });
    }

    try {
      const refund = await razorpay.payments.refund(booking.razorpayPaymentId, {
        amount: booking.amount * 100,
      });

      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          refundStatus: "PROCESSED",
          razorpayRefundId: refund.id,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Refund processed successfully",
        data: updated,
      });
    } catch (razorpayError) {
      console.error("Razorpay refund error:", razorpayError);

      await prisma.booking.update({
        where: { id: booking.id },
        data: { refundStatus: "FAILED" },
      });

      return res.status(500).json({
        success: false,
        message:
          "Refund could not be processed. Please try again or contact support.",
        error: razorpayError.message,
      });
    }
  } catch (err) {
    console.error("Request refund error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to process refund request",
      error: err.message,
    });
  }
};
