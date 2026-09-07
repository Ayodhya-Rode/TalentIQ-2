import prisma from "../config/db.js";
import razorpay from "../config/razorpay.js";
import crypto from "crypto";
import { Prisma } from "../generated/prisma/index.js";
import { notifyBookingConfirmed } from "../utils/notifications.js";

const BOOKING_AMOUNT_RUPEES = 100;
const MAX_BOOKINGS_PER_EMPLOYEE = 3;
const STALE_MINUTES = 15;
const VISIBILITY_DAYS = 7;

/**
 * Helpers to calculate booking window and stale cutoff times.
 */
const getBookingWindowEnd = () => {
  return new Date(Date.now() + VISIBILITY_DAYS * 24 * 60 * 60 * 1000);
};

const getStaleCutoff = () => {
  return new Date(Date.now() - STALE_MINUTES * 60 * 1000);
};

// To be called after a booking is confirmed, to send notification emails to both candidate and employee.
const sendBookingConfirmedNotification = async (bookingId) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      slot: true,
      candidateProfile: { include: { user: { select: { name: true, email: true } } } },
      employeeProfile: { include: { user: { select: { name: true, email: true } } } },
    },
  });

  if (!booking) return;

  await notifyBookingConfirmed({
    candidateEmail: booking.candidateProfile.user.email,
    candidateName: booking.candidateProfile.user.name,
    employeeEmail: booking.employeeProfile.user.email,
    employeeName: booking.employeeProfile.user.name,
    slot: booking.slot,
  });
};

/**
 * Checks a slot's abandoned PENDING_PAYMENT booking after STALE_MINUTES.
 * Confirms with Razorpay first — if it was actually paid, force-confirms
 * the booking instead of deleting it; only deletes if truly unpaid.
 */
const releaseIfStale = async (slotId) => {
  const staleCutoff = getStaleCutoff();

  const pendingBooking = await prisma.booking.findUnique({
    where: {
      slotId,
    },
  });

  if (!pendingBooking) {
    return false;
  }

  // Only stale PENDING_PAYMENT bookings should be processed.
  if (
    pendingBooking.status !== "PENDING_PAYMENT" ||
    pendingBooking.createdAt >= staleCutoff
  ) {
    return false;
  }

  // ==========================================================
  // CHECK RAZORPAY BEFORE DELETING THE BOOKING
  // ==========================================================

  if (pendingBooking.razorpayOrderId) {
    try {
      const order = await razorpay.orders.fetch(pendingBooking.razorpayOrderId);

      // --------------------------------------------------------
      // Order is paid.
      // Do NOT release the slot.
      // --------------------------------------------------------

      if (order.status === "paid") {
        // Fetch payments belonging to this order
        const payments = await razorpay.orders.fetchPayments(
          pendingBooking.razorpayOrderId,
        );

        // Find a captured payment
        const capturedPayment = payments.items?.find(
          (payment) =>
            payment.status === "captured" &&
            Number(payment.amount) === BOOKING_AMOUNT_RUPEES * 100 &&
            payment.currency === "INR",
        );

        if (!capturedPayment) {
          console.warn(
            `Booking ${pendingBooking.id}: Razorpay order is paid, but no valid captured payment was found.`,
          );

          // Don't delete a potentially paid booking.
          return false;
        }

        // ------------------------------------------------------
        // Payment is genuinely captured.
        // Confirm booking.
        // ------------------------------------------------------

        const updated = await prisma.booking.updateMany({
          where: {
            id: pendingBooking.id,
            status: "PENDING_PAYMENT",
          },

          data: {
            status: "CONFIRMED",
            razorpayPaymentId: capturedPayment.id,
          },
        });

        if (updated.count > 0) {
          console.warn(
            `Booking ${pendingBooking.id} was paid but verify-payment was never called. Booking force-confirmed.`,
          );
          await sendBookingConfirmedNotification(pendingBooking.id);
        }

        // Slot remains BOOKED.
        return false;
      }

      // --------------------------------------------------------
      // Order is not paid.
      //
      // Examples:
      // created
      // attempted
      // expired
      // --------------------------------------------------------
    } catch (err) {
      // --------------------------------------------------------
      // Razorpay cannot be reached.
      //
      // DO NOT delete the booking because we cannot safely
      // determine whether money moved.
      // --------------------------------------------------------

      console.error(
        `Failed to check Razorpay order status for booking ${pendingBooking.id}:`,
        err.message,
      );

      return false;
    }
  }

  // ==========================================================
  // RELEASE STALE UNPAID BOOKING
  // ==========================================================

  await prisma.$transaction(async (tx) => {
    const deletedBooking = await tx.booking.deleteMany({
      where: {
        id: pendingBooking.id,
        status: "PENDING_PAYMENT",
      },
    });

    // Only reopen the slot if the booking was actually deleted.
    if (deletedBooking.count > 0) {
      await tx.slot.updateMany({
        where: {
          id: slotId,
          status: "BOOKED",
        },

        data: {
          status: "OPEN",
        },
      });
    }
  });

  return true;
};

/**
 * GET EMPLOYEES BY CATEGORY -
 * @desc Fetch employees who belong to a specific category and have available slots within the booking window.
 * @route GET /api/candidate/bookings/employees?categoryId=<categoryId>
 * @access CANDIDATE
 */
export const getEmployeesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.query;

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: "categoryId is required",
      });
    }

    const now = new Date();
    const windowEnd = getBookingWindowEnd();

    const employees = await prisma.employeeProfile.findMany({
      where: {
        categories: {
          some: {
            categoryId,
          },
        },
        user: {
          status: "APPROVED",
        },
      },

      include: {
        user: {
          select: {
            name: true,
          },
        },

        slots: {
          where: {
            status: "OPEN",
            startTime: {
              gte: now,
              lte: windowEnd,
            },
          },

          orderBy: {
            startTime: "asc",
          },
        },
      },
    });

    // only return employees who have at least one available slot
    const employeesWithSlots = employees.filter((emp) => emp.slots.length > 0);

    return res.status(200).json({
      success: true,
      data: employeesWithSlots,
    });
  } catch (err) {
    console.error("Get employees by category error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch employees",
      error: err.message,
    });
  }
};

/**
 * CREATE BOOKING ORDER -
 * @desc Create a new booking order for a candidate.
 * @route POST /api/candidate/bookings/create-order
 * @access CANDIDATE
 */
export const createBookingOrder = async (req, res) => {
  try {
    const { slotId } = req.body;

    if (!slotId) {
      return res.status(400).json({
        success: false,
        message: "slotId is required",
      });
    }

    // --------------------------------------------------------
    // 1. Get candidate profile
    // --------------------------------------------------------

    const candidateProfile = await prisma.candidateProfile.findUnique({
      where: {
        userId: req.user.userId,
      },
    });

    if (!candidateProfile) {
      return res.status(404).json({
        success: false,
        message: "Complete your candidate profile before booking",
      });
    }

    // --------------------------------------------------------
    // 2. Get slot
    // --------------------------------------------------------

    let slot = await prisma.slot.findUnique({
      where: {
        id: slotId,
      },
    });

    if (!slot) {
      return res.status(404).json({
        success: false,
        message: "Slot not found",
      });
    }

    // --------------------------------------------------------
    // 3. Validate booking window
    // --------------------------------------------------------

    const now = new Date();
    const windowEnd = getBookingWindowEnd();

    if (slot.startTime <= now) {
      return res.status(400).json({
        success: false,
        message: "This slot has already started or expired",
      });
    }

    if (slot.startTime > windowEnd) {
      return res.status(400).json({
        success: false,
        message: "Slot is outside the bookable window",
      });
    }

    // --------------------------------------------------------
    // 4. Release stale booking if necessary
    // --------------------------------------------------------

    await releaseIfStale(slotId);

    // Get fresh slot state after stale cleanup
    slot = await prisma.slot.findUnique({
      where: {
        id: slotId,
      },
    });

    if (!slot) {
      return res.status(404).json({
        success: false,
        message: "Slot not found",
      });
    }

    if (slot.status !== "OPEN") {
      return res.status(409).json({
        success: false,
        message: "Slot is no longer available",
      });
    }

    // --------------------------------------------------------
    // 5. Maximum bookings with same employee — capped per rolling week
    // --------------------------------------------------------

    const weekAgo = new Date(
      now.getTime() - VISIBILITY_DAYS * 24 * 60 * 60 * 1000,
    );

    const recentCount = await prisma.booking.count({
      where: {
        candidateProfileId: candidateProfile.id,
        employeeProfileId: slot.employeeProfileId,
        status: { in: ["PENDING_PAYMENT", "CONFIRMED", "COMPLETED"] },
        createdAt: { gte: weekAgo },
      },
    });

    if (recentCount >= MAX_BOOKINGS_PER_EMPLOYEE) {
      return res.status(403).json({
        success: false,
        message: `You can book at most ${MAX_BOOKINGS_PER_EMPLOYEE} slots with the same employee per week`,
      });
    }

    // --------------------------------------------------------
    // 6. Atomically lock slot
    //
    // Only OPEN slot can become BOOKED.
    // If another candidate got it first, count = 0.
    // --------------------------------------------------------

    const lockResult = await prisma.slot.updateMany({
      where: {
        id: slotId,
        status: "OPEN",
      },

      data: {
        status: "BOOKED",
      },
    });

    if (lockResult.count !== 1) {
      return res.status(409).json({
        success: false,
        message: "Slot is no longer available",
      });
    }

    // --------------------------------------------------------
    // 7. Create Razorpay order
    // --------------------------------------------------------

    let razorpayOrder;

    try {
      razorpayOrder = await razorpay.orders.create({
        amount: BOOKING_AMOUNT_RUPEES * 100,
        currency: "INR",
        receipt: `bk_${Date.now()}`,
      });
    } catch (razorpayError) {
      // Razorpay order creation failed.
      // Reopen the slot.
      await prisma.slot.updateMany({
        where: {
          id: slotId,
          status: "BOOKED",
        },

        data: {
          status: "OPEN",
        },
      });

      throw razorpayError;
    }

    // --------------------------------------------------------
    // 8. Create pending booking
    // --------------------------------------------------------

    let booking;

    try {
      booking = await prisma.booking.create({
        data: {
          candidateProfileId: candidateProfile.id,
          employeeProfileId: slot.employeeProfileId,
          slotId: slot.id,
          amount: BOOKING_AMOUNT_RUPEES,
          status: "PENDING_PAYMENT",
          razorpayOrderId: razorpayOrder.id,
        },
      });
    } catch (bookingError) {
      // DB booking creation failed.
      // Reopen slot.
      await prisma.slot.updateMany({
        where: {
          id: slotId,
          status: "BOOKED",
        },

        data: {
          status: "OPEN",
        },
      });

      throw bookingError;
    }

    // --------------------------------------------------------
    // 9. Return Razorpay information
    // --------------------------------------------------------

    return res.status(201).json({
      success: true,
      message: "Booking order created successfully",

      data: {
        bookingId: booking.id,
        razorpayOrderId: razorpayOrder.id,
        amount: BOOKING_AMOUNT_RUPEES * 100,
        currency: "INR",
      },
    });
  } catch (err) {
    // Unique constraint
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message: "A booking already exists for this slot",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create booking order",
      error: err.message,
    });
  }
};

/**
 * VERIFY BOOKING PAYMENT -
 * @desc Verify Razorpay payment for a booking and confirm the booking if valid.
 * @route POST /api/candidate/bookings/verify-payment
 * @access CANDIDATE
 */
export const verifyBookingPayment = async (req, res) => {
  try {
    const {
      bookingId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    // --------------------------------------------------------
    // 1. Validate request
    // --------------------------------------------------------

    if (
      !bookingId ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message:
          "bookingId, razorpay_order_id, razorpay_payment_id and razorpay_signature are required",
      });
    }

    // --------------------------------------------------------
    // 2. Get candidate
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // 3. Get booking
    // --------------------------------------------------------

    const booking = await prisma.booking.findUnique({
      where: {
        id: bookingId,
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // --------------------------------------------------------
    // 4. Authorization
    // --------------------------------------------------------

    if (booking.candidateProfileId !== candidateProfile.id) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to verify this booking",
      });
    }

    // --------------------------------------------------------
    // 5. Idempotency
    //
    // If frontend accidentally sends verification twice,
    // don't treat the second request as an error.
    // --------------------------------------------------------

    if (booking.status === "CONFIRMED") {
      return res.status(200).json({
        success: true,
        message: "Booking is already confirmed",
        data: booking,
      });
    }

    if (booking.status !== "PENDING_PAYMENT") {
      return res.status(400).json({
        success: false,
        message: `Booking cannot be verified because its status is ${booking.status}`,
      });
    }

    // --------------------------------------------------------
    // 6. Verify Razorpay order ID
    // --------------------------------------------------------

    if (booking.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({
        success: false,
        message: "Razorpay order ID mismatch",
      });
    }

    // --------------------------------------------------------
    // 7. Verify signature
    // --------------------------------------------------------

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      console.error("RAZORPAY_KEY_SECRET is missing");

      return res.status(500).json({
        success: false,
        message: "Payment configuration error",
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const receivedBuffer = Buffer.from(razorpay_signature, "utf8");

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment signature verification failed",
      });
    }

    // --------------------------------------------------------
    // 8. Fetch actual payment from Razorpay
    //
    // This prevents trusting amount/currency from frontend.
    // --------------------------------------------------------

    let payment;

    try {
      payment = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (razorpayError) {
      console.error("Razorpay payment fetch error:", razorpayError);

      return res.status(400).json({
        success: false,
        message: "Unable to verify payment with Razorpay",
      });
    }

    // --------------------------------------------------------
    // 9. Verify payment belongs to expected order
    // --------------------------------------------------------

    if (payment.order_id !== razorpay_order_id) {
      return res.status(400).json({
        success: false,
        message: "Payment does not belong to this order",
      });
    }

    // --------------------------------------------------------
    // 10. Verify amount
    // --------------------------------------------------------

    const expectedAmount = BOOKING_AMOUNT_RUPEES * 100;

    if (Number(payment.amount) !== expectedAmount) {
      return res.status(400).json({
        success: false,
        message: "Payment amount mismatch",
      });
    }

    // --------------------------------------------------------
    // 11. Verify currency
    // --------------------------------------------------------

    if (payment.currency !== "INR") {
      return res.status(400).json({
        success: false,
        message: "Payment currency mismatch",
      });
    }

    // --------------------------------------------------------
    // 12. Verify payment status
    // --------------------------------------------------------

    if (payment.status !== "captured") {
      return res.status(400).json({
        success: false,
        message: `Payment is not captured. Current status: ${payment.status}`,
      });
    }

    // --------------------------------------------------------
    // 13. Confirm booking
    //
    // updateMany prevents two simultaneous verification
    // requests from creating conflicting updates.
    // --------------------------------------------------------

    const updateResult = await prisma.booking.updateMany({
      where: {
        id: booking.id,
        candidateProfileId: candidateProfile.id,
        status: "PENDING_PAYMENT",
        razorpayOrderId: razorpay_order_id,
      },

      data: {
        status: "CONFIRMED",
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      },
    });

    // Another request may have confirmed it first.
    if (updateResult.count === 0) {
      const latestBooking = await prisma.booking.findUnique({
        where: {
          id: booking.id,
        },

        include: {
          slot: true,

          employeeProfile: {
            include: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      if (latestBooking?.status === "CONFIRMED") {
        return res.status(200).json({
          success: true,
          message: "Booking confirmed successfully",
          data: latestBooking,
        });
      }

      return res.status(409).json({
        success: false,
        message: "Booking could not be confirmed",
      });
    }

    await sendBookingConfirmedNotification(booking.id);

    // --------------------------------------------------------
    // 14. Get final booking
    // --------------------------------------------------------

    const confirmedBooking = await prisma.booking.findUnique({
      where: {
        id: booking.id,
      },

      include: {
        slot: true,

        employeeProfile: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Booking confirmed successfully",
      data: confirmedBooking,
    });
  } catch (err) {
    console.error("Verify booking payment error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to verify payment",
      error: err.message,
    });
  }
};

/**
 * GET MY BOOKINGS -
 * @desc Fetch all bookings for the authenticated candidate.
 * @route GET /api/candidate/bookings/my-bookings
 * @access CANDIDATE
 */
export const getMyBookings = async (req, res) => {
  try {
    // --------------------------------------------------------
    // 1. Get candidate profile
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // 2. Get bookings
    // --------------------------------------------------------

    const bookings = await prisma.booking.findMany({
      where: {
        candidateProfileId: candidateProfile.id,
      },

      include: {
        slot: true,

        employeeProfile: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (err) {
    console.error("Get my bookings error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
      error: err.message,
    });
  }
};

/**
 * GET EMPLOYEE OPEN SLOTS -
 * @desc Fetch all open slots for a specific employee.
 * @route GET /api/candidate/bookings/employees/:employeeProfileId/open-slots
 * @access CANDIDATE
 */
export const getEmployeeOpenSlots = async (req, res) => {
  try {
    const { employeeProfileId } = req.params;
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const slots = await prisma.slot.findMany({
      where: {
        employeeProfileId,
        status: "OPEN",
        startTime: { gte: now, lte: windowEnd },
      },
      orderBy: { startTime: "asc" },
    });

    return res.status(200).json({ success: true, data: slots });
  } catch (err) {
    console.error("Get employee open slots error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch slots",
      error: err.message,
    });
  }
};