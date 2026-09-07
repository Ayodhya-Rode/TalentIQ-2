import { sendEmail } from "./sendEmail.js";

const safeSend = async (opts) => {
  try {
    await sendEmail(opts);
  } catch (err) {
    console.error(
      `Notification email failed (subject: "${opts.subject}", to: ${opts.to}):`,
      err.message,
    );
  }
};

const formatDateTime = (date) =>
  new Date(date).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const formatTime = (date) =>
  new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

export const notifyBookingConfirmed = async ({
  candidateEmail,
  candidateName,
  employeeEmail,
  employeeName,
  slot,
}) => {
  const when = formatDateTime(slot.startTime);
  await Promise.all([
    safeSend({
      to: candidateEmail,
      subject: "Your TalentIQ interview is confirmed",
      htmlContent: `
        <h2>Hi ${candidateName},</h2>
        <p>Your mock interview with <strong>${employeeName}</strong> is confirmed.</p>
        <p><strong>When:</strong> ${when}</p>
        <p>Good luck!</p>
      `,
    }),
    safeSend({
      to: employeeEmail,
      subject: "New interview booking confirmed",
      htmlContent: `
        <h2>Hi ${employeeName},</h2>
        <p><strong>${candidateName}</strong> has booked and paid for a mock interview with you.</p>
        <p><strong>When:</strong> ${when}</p>
      `,
    }),
  ]);
};

export const notifyReminder = async ({
  candidateEmail,
  candidateName,
  employeeEmail,
  employeeName,
  slot,
  bookingId,
}) => {
  const startsAt = formatTime(slot.startTime);
  const joinLink = `${process.env.FRONTEND_URL}/interview-room/${bookingId}`;

  await Promise.all([
    safeSend({
      to: candidateEmail,
      subject: "Reminder: your interview starts in 10 minutes",
      htmlContent: `
        <h2>Hi ${candidateName},</h2>
        <p>Your mock interview with <strong>${employeeName}</strong> starts at <strong>${startsAt}</strong> — in about 10 minutes.</p>
        <p><a href="${joinLink}">Click here to join the interview</a></p>
      `,
    }),
    safeSend({
      to: employeeEmail,
      subject: "Reminder: interview starts in 10 minutes",
      htmlContent: `
        <h2>Hi ${employeeName},</h2>
        <p>Your mock interview with <strong>${candidateName}</strong> starts at <strong>${startsAt}</strong> — in about 10 minutes.</p>
        <p><a href="${joinLink}">Click here to join the interview</a></p>
      `,
    }),
  ]);
};

export const notifyCancellation = async ({
  candidateEmail,
  candidateName,
  employeeName,
  reason,
}) => {
  await safeSend({
    to: candidateEmail,
    subject: "Your interview was cancelled",
    htmlContent: `
      <h2>Hi ${candidateName},</h2>
      <p><strong>${employeeName}</strong> has cancelled your upcoming mock interview.</p>
      <p><strong>Reason given:</strong> ${reason}</p>
      <p>You have a few options:</p>
      <ul>
        <li>Rebook another open slot with the same employee (no extra payment needed)</li>
        <li>Browse and book a different employee</li>
        <li>Request a full refund of your ₹100 payment</li>
      </ul>
      <p>Head to "My Bookings" in your dashboard to choose.</p>
    `,
  });
};

export const notifyPostponement = async ({
  candidateEmail,
  candidateName,
  employeeName,
  newSlot,
}) => {
  const when = formatDateTime(newSlot.startTime);

  await safeSend({
    to: candidateEmail,
    subject: "Your interview has been rescheduled",
    htmlContent: `
      <h2>Hi ${candidateName},</h2>
      <p>
  Just a quick update: your mock interview with <strong>${employeeName}</strong>
  has been rescheduled to a new time.
</p>

<p>
  <strong>New date & time:</strong> ${when}
</p>

<p>
  Your booking remains confirmed for this new slot. Thanks for your
  understanding, and we’ll see you at the interview!
</p>
    `,
  });
};

export const notifyCancellationLimitReached = async ({
  employeeEmail,
  employeeName,
  limit,
}) => {
  await safeSend({
    to: employeeEmail,
    subject: "Warning: monthly cancellation/postponement limit reached",
    htmlContent: `
      <h2>Hi ${employeeName},</h2>
      <p>You've reached the limit of <strong>${limit}</strong> cancellations/postponements for this calendar month.</p>
      <p>Repeated cancellations affect candidate trust in the platform. Our Super Admin team has been notified and may review your account.</p>
      <p>Please try to honor your remaining confirmed interviews for the rest of the month.</p>
    `,
  });
};
