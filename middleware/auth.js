import User from "../models/User.js";

// Check if user is authenticated for API routes
export const requireAuth = async (req, res, next) => {
  const userId = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const user = await User.getById(userId);

    if (!user) {
      req.session.destroy((err) => {
        if (err) console.error("Session destroy error:", err);
      });
      return res.status(401).json({ error: "User not found" });
    }

    req.user = {
      user_id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Authentication error" });
  }
};

// Check if user is admin
export const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

// Check if user is authenticated for web routes
export const requireAuthWeb = async (req, res, next) => {
  const userId = req.session?.userId;

  if (!userId) {
    return res.redirect("/login");
  }

  try {
    const user = await User.getById(userId);

    if (!user) {
      req.session.destroy((err) => {
        if (err) console.error("Session destroy error:", err);
      });
      return res.redirect("/login");
    }
    req.user = {
      user_id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.redirect("/login");
  }
};
