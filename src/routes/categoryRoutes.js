import express from "express";
import { verifyToken, authorize } from "../middlewares/authMiddleware.js";
import { createCategory, updateCategory, deleteCategory, getCategories } from "../controller/categoryController.js";

const router = express.Router();

router.get("/get-all-categories", verifyToken, getCategories);
router.post("/create-category", verifyToken, authorize("SUPER_ADMIN"), createCategory);
router.patch("/update-category/:id", verifyToken, authorize("SUPER_ADMIN"), updateCategory);
router.delete("/delete-category/:id", verifyToken, authorize("SUPER_ADMIN"), deleteCategory);

export default router;