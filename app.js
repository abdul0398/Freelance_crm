import express from "express";
import session from "express-session";
import cors from "cors";
import path from "path";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import MySQLStoreFactory from "express-mysql-session";
import apiRoutes from "./routes/api.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import { requireAuthWeb } from "./middleware/auth.js";
import User from "./models/User.js";
const __dirname = path.resolve();
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3020;
const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});
// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-session-secret",
    resave: false,
    store: sessionStore,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Set EJS as template engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/", authRoutes);
app.use("/api", apiRoutes);
app.use("/api/admin", adminRoutes);

// Main route - serve the CRM interface (requires authentication)
app.get("/", requireAuthWeb, (req, res) => {
  res.render("dashboard", { user: req.user });
});

// Admin panel route
app.get("/admin", requireAuthWeb, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.redirect("/");
  }
  res.render("admin", { user: req.user });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Error:", error);
  res.status(500).json({ error: "Internal server error" });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).render("404");
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});
