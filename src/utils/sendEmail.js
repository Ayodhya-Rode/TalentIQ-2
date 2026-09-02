import config from "../config/config.js"

export const sendEmail = async ({ to, subject, htmlContent }) => {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": config.brevoApiKey,
    },
    body: JSON.stringify({
      sender: { email: config.brevoSenderEmail, name: "TalentIQ" },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to send email");
  }
  return data;
};