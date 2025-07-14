import express from "express";
import User from "../models/User.js";
const router = express.Router();
// Login page

// Login page
router.get("/login", (req, res) => {
  // Check if user is already logged in by looking for userId in session
  if (req.session?.userId) {
    return res.redirect("/");
  }
  res.render("auth/login", { error: null });
});

// Login POST
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.render("login", {
        error: "Please provide both username and password",
      });
    }
    const authResult = await User.authenticate(username, password);
    console.log(authResult, "sdsffsdf");

    if (!authResult) {
      return res.render("login", { error: "Invalid username or password" });
    }

    // Store user info in session
    req.session.userId = authResult.user.id;
    req.session.user = authResult.user;
    req.session.sessionId = authResult.sessionId;

    res.redirect("/");
  } catch (error) {
    console.error("Login error:", error);
    res.render("login", { error: "An error occurred during login" });
  }
});

// Logout
router.post("/logout", async (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ error: "Could not log out" });
    }
    res.clearCookie("connect.sid"); // Clear the session cookie
    res.redirect("/login");
  });
});

// API Login
router.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    const user = await User.authenticate(username, password);

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Store user info in session
    req.session.userId = user.id;
    req.session.user = user;

    res.json({
      success: true,
      user: user,
      message: "Login successful",
    });
  } catch (error) {
    console.error("API Login error:", error);
    res.status(500).json({ error: "An error occurred during login" });
  }
});

// API Logout
router.post("/api/logout", async (req, res) => {
  try {
    if (req.session?.sessionId) {
      await User.logout(req.session.sessionId);
    }
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destroy error:", err);
      }
    });
    res.json({ success: true, message: "Logout successful" });
  } catch (error) {
    console.error("API Logout error:", error);
    res.status(500).json({ error: "An error occurred during logout" });
  }
});

// Get current user
router.get("/api/me", async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const user = await User.getById(userId);

    if (!user) {
      req.session.destroy();
      return res.status(401).json({ error: "User not found" });
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user information" });
  }
});

export default router;
