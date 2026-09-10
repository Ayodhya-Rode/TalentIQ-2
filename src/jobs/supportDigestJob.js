import cron from "node-cron";
import prisma from "../config/db.js";
import { sendEmail } from "../utils/sendEmail.js";

const sendDailySupportDigest = async () => {
  try {
    const [total, solved, pending] = await Promise.all([
      prisma.supportQuery.count(),
      prisma.supportQuery.count({ where: { status: "RESOLVED" } }),
      prisma.supportQuery.count({ where: { status: "OPEN" } }),
    ]);

    const superAdmins = await prisma.user.findMany({
      where: { role: "SUPER_ADMIN", status: "APPROVED" },
      select: { name: true, email: true },
    });

    if (superAdmins.length === 0) return;

    const today = new Date().toLocaleDateString("en-IN", { dateStyle: "medium" });

    await Promise.all(
      superAdmins.map((admin) =>
        sendEmail({
          to: admin.email,
          subject: `TalentIQ Support Summary — ${today}`,
          htmlContent: `
            <h2>Hi ${admin.name},</h2>
            <p>Here's today's support query summary:</p>
            <ul>
              <li><strong>Total Queries:</strong> ${total}</li>
              <li><strong>Solved:</strong> ${solved}</li>
              <li><strong>Pending:</strong> ${pending}</li>
            </ul>
            <p>You can review pending queries from the Support Dashboard.</p>
          `,
        }).catch((err) => console.error(`Support digest email failed for ${admin.email}:`, err.message)),
      ),
    );

    console.log("Daily support digest sent to Super Admin(s).");
  } catch (err) {
    console.error("Support digest job error:", err.message);
  }
};

export const startSupportDigestJob = () => {
  cron.schedule("0 18 * * *", sendDailySupportDigest, {
    timezone: "Asia/Kolkata",
  }); // 6 PM daily
  console.log("Support digest job scheduled (daily at 6 PM).");
};