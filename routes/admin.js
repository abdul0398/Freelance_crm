import express from "express";
const router = express.Router();
import User from "../models/User.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

// Apply authentication middleware
router.use(requireAuth);
router.use(requireAdmin);

// Get all users
router.get("/users", async (req, res) => {
  try {
    const users = await User.getAll(req.user.role, req.user.user_id);
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Get user by ID
router.get("/users/:id", async (req, res) => {
  try {
    const user = await User.getById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Create new user
router.post("/users", async (req, res) => {
  try {
    const { name, email, password, role = "user" } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Name, email, and password are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters long" });
    }

    const userId = await User.create({ name, email, password, role });
    const user = await User.getById(userId);

    res.status(201).json(user);
  } catch (error) {
    console.error("Error creating user:", error);
    if (error.message === "Email already exists") {
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Update user
router.put("/users/:id", async (req, res) => {
  try {
    const { name, email, role } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    const user = await User.update(req.params.id, { name, email, role });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Update user password
router.put("/users/:id/password", async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters long" });
    }

    await User.updatePassword(req.params.id, password);
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ error: "Failed to update password" });
  }
});

// Delete user
router.delete("/users/:id", async (req, res) => {
  try {
    // Prevent admin from deleting themselves
    if (req.user.user_id.toString() === req.params.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const deleted = await User.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
