import pdf from "pdf-parse/lib/pdf-parse.js"; // direct path avoids the package's debug-code bug

const MAX_PDF_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_CHARS = 6000; // keeps the prompt cheap
const MIN_USEFUL_CHARS = 200; // below this, treat as scanned/empty

// Remove personal identifiers, since the AI doesn't need them
const scrub = (text) =>
  text
    .replace(/[<>]/g, " ") // blocks "</candidate_data>" breakouts
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\+?\d[\d\s().-]{8,}\d/g, (m) => {
      const digits = m.replace(/\D/g, "").length;
      return digits >= 10 && digits <= 13 ? "[phone]" : m; // keep date ranges
    })
    .replace(/https?:\/\/\S+/g, "[link]");
    
// Returns cleaned resume text, or null if unusable (never throws)
export const extractResumeText = async (resumeUrl) => {
  if (!resumeUrl) return null;
  try {
    const res = await fetch(resumeUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_PDF_BYTES) return null;

    const { text } = await pdf(buf);
    const cleaned = scrub(text.replace(/\s+/g, " ").trim());
    if (cleaned.length < MIN_USEFUL_CHARS) return null;

    return cleaned.slice(0, MAX_CHARS);
  } catch (err) {
    console.error("Resume extraction failed:", err.message);
    return null;
  }
};

// Fallback built from structured profile data
export const buildProfileText = (profile) => {
  const parts = [];
  if (profile.designation) parts.push(`Target role: ${profile.designation}`);
  if (profile.education) parts.push(`Education: ${profile.education}`);
  if (profile.skills) parts.push(`Skills: ${profile.skills}`);
  (profile.projects || []).forEach((p, i) => {
    parts.push(`Project ${i + 1}: ${p.title}${p.description ? " - " + p.description : ""}`);
  });
  return scrub(parts.join("\n")).slice(0, MAX_CHARS);
};

// Main entry: resume first, profile as fallback
export const getCandidateContext = async (profile) => {
  const resumeText = await extractResumeText(profile.resumeUrl);
  if (resumeText) return { source: "resume", text: resumeText };

  const profileText = buildProfileText(profile);
  if (profileText.length < 30) return { source: "none", text: null };
  return { source: "profile", text: profileText };
};