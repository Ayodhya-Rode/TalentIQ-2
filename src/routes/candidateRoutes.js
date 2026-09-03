import express from "express";
import { verifyToken, authorize } from "../middlewares/authMiddleware.js";
import {
  createCandidateProfile,
  getCandidateProfile,
  updateCandidateProfile,
  addProject,
  updateProject,
  deleteProject,
  addCertificate,
  updateCertificate,
  deleteCertificate,
} from "../controller/candidateController.js";

const router = express.Router();

router.post("/create-profile", verifyToken, authorize("CANDIDATE"), createCandidateProfile);
router.get("/get-profile", verifyToken, authorize("CANDIDATE"), getCandidateProfile);
router.put("/update-profile", verifyToken, authorize("CANDIDATE"), updateCandidateProfile);

router.post("/add-projects", verifyToken, authorize("CANDIDATE"), addProject);
router.put("/update-projects/:id", verifyToken, authorize("CANDIDATE"), updateProject);
router.delete("/delete-projects/:id", verifyToken, authorize("CANDIDATE"), deleteProject);

router.post("/add-certificates", verifyToken, authorize("CANDIDATE"), addCertificate);
router.put("/update-certificates/:id", verifyToken, authorize("CANDIDATE"), updateCertificate);
router.delete("/delete-certificates/:id", verifyToken, authorize("CANDIDATE"), deleteCertificate);

export default router;