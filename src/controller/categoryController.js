import prisma from "../config/db.js";
import { Prisma } from "../generated/prisma/index.js";

/**
 * Controller for creating a new category- only superadmin can create a category
 * @desc Creates a new category in the database
 * @route POST /api/categories/create-category
 * @access Private - Super Admin 
 */
export const createCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    const cleanName = name.trim();

    const category = await prisma.category.create({
      data: { name: cleanName },
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Category already exists",
      });
    }
    console.error("Create category error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create category",
      error: err.message,
    });
  }
};

/**
 * Controller for updating an existing category- only superadmin can update a category
 * @desc Updates an existing category in the database
 * @route PATCH /api/categories/update-category/:id
 * @access Private - Super Admin
 */
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    const cleanName = name.trim();

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: { name: cleanName },
    });

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: updatedCategory,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Category already exists",
      });
    }
    console.error("Update category error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update category",
      error: err.message,
    });
  }
};

/**
 * Controller for deleting a category- only superadmin can delete a category
 * @desc Deletes a category from the database
 * @route DELETE /api/categories/delete-category/:id
 * @access Private - Super Admin
 */
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    await prisma.category.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return res.status(409).json({
        success: false,
        message: "Cannot delete category: it is assigned to one or more employees",
      });
    }
    console.error("Delete category error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete category",
      error: err.message,
    });
  }
};

/**
 * Controller for fetching all categories
 * @desc Fetches all categories from the database
 * @route GET /api/categories/get-all-categories
 * @access Private - Authenticated Users
 */
export const getCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
    });

    return res.status(200).json({
      success: true,
      message: "Categories fetched successfully",
      data: categories,
    });
  } catch (err) {
    console.error("Get categories error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: err.message,
    });
  }
};