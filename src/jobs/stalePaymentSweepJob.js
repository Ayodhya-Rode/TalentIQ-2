import cron from "node-cron";
import prisma from "../config/db.js";
import razorpay from "../config/razorpay.js";

const STALE_MINUTES = 15;

const sweepStalePayments = async () => {
  try {
    const staleCutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000);

    const staleBookings = await prisma.booking.findMany({
      where: { status: "PENDING_PAYMENT", createdAt: { lt: staleCutoff } },
    });

    for (const booking of staleBookings) {
      if (booking.razorpayOrderId) {
        try {
          const order = await razorpay.orders.fetch(booking.razorpayOrderId);
          if (order.status === "paid") {
            const payments = await razorpay.orders.fetchPayments(booking.razorpayOrderId);
            const captured = payments.items?.find(
              (p) => p.status === "captured" && Number(p.amount) === booking.amount * 100
            );
            if (captured) {
              await prisma.booking.update({
                where: { id: booking.id },
                data: { status: "CONFIRMED", razorpayPaymentId: captured.id },
              });
              console.warn(`Sweep: booking ${booking.id} was paid but unverified — force-confirmed.`);
              continue;
            }
          }
        } catch (err) {
          console.error(`Sweep: failed to check Razorpay for booking ${booking.id}:`, err.message);
          continue; // don't delete if we couldn't verify
        }
      }

      await prisma.$transaction([
        prisma.booking.delete({ where: { id: booking.id } }),
        prisma.slot.updateMany({
          where: { id: booking.slotId, status: "BOOKED" },
          data: { status: "OPEN" },
        }),
      ]);
      console.log(`Sweep: released stale booking ${booking.id}, slot reopened.`);
    }
  } catch (err) {
    console.error("Stale payment sweep error:", err.message);
  }
};

export const startStalePaymentSweepJob = () => {
  cron.schedule("*/5 * * * *", sweepStalePayments); // every 5 minutes
  console.log("Stale payment sweep job scheduled (every 5 minutes).");
};