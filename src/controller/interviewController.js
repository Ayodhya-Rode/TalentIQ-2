import prisma from "../config/db.js";

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
