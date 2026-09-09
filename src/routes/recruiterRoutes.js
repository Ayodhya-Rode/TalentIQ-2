import express from "express";
import { verifyToken, authorize } from "../middlewares/authMiddleware.js";
import {
  getCandidates,
  getEmailHistory,
  sendOutreachEmail,
  createRecruiterProfile,
  getRecruiterProfile,
  updateRecruiterProfile,
  getMyOutreachHistory 
} from "../controller/recruiterController.js";

const router = express.Router();

router.post("/profile", verifyToken, authorize("RECRUITER"), createRecruiterProfile);
router.get("/profile", verifyToken, authorize("RECRUITER"), getRecruiterProfile);
router.put("/profile", verifyToken, authorize("RECRUITER"), updateRecruiterProfile);

router.get("/candidates", verifyToken, authorize("RECRUITER"), getCandidates);
router.get("/candidates/:candidateProfileId/email-history", verifyToken, authorize("RECRUITER"), getEmailHistory);
router.post("/candidates/:candidateProfileId/outreach-email", verifyToken, authorize("RECRUITER"), sendOutreachEmail);

router.get("/outreach-history", verifyToken, authorize("RECRUITER"), getMyOutreachHistory);
export default router;