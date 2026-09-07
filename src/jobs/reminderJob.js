import cron from "node-cron";
import prisma from "../config/db.js";
import { notifyReminder } from "../utils/notifications.js";

const REMINDER_WINDOW_START_MIN = 9;
const REMINDER_WINDOW_END_MIN = 11;

const sendDueReminders = async () => {
  const now = new Date();
  const windowStart = new Date(now.getTime() + REMINDER_WINDOW_START_MIN * 60 * 1000);
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_END_MIN * 60 * 1000);

  try {
    const bookings = await prisma.booking.findMany({
      where: {
        status: "CONFIRMED",
        reminderSentAt: null,
        slot: { startTime: { gte: windowStart, lte: windowEnd } },
      },
      include: {
        slot: true,
        candidateProfile: { include: { user: { select: { name: true, email: true } } } },
        employeeProfile: { include: { user: { select: { name: true, email: true } } } },
      },
    });

    for (const booking of bookings) {
      await notifyReminder({
        candidateEmail: booking.candidateProfile.user.email,
        candidateName: booking.candidateProfile.user.name,
        employeeEmail: booking.employeeProfile.user.email,
        employeeName: booking.employeeProfile.user.name,
        slot: booking.slot,
        bookingId: booking.id,
      });

      // Guard with reminderSentAt: null so a slow tick can't double-send.
      await prisma.booking.updateMany({
        where: { id: booking.id, reminderSentAt: null },
        data: { reminderSentAt: new Date() },
      });
    }
  } catch (err) {
    console.error("Reminder job error:", err.message);
  }
};

export const startReminderJob = () => {
  cron.schedule("* * * * *", sendDueReminders);
  console.log("Interview reminder job scheduled (every minute).");
};