import dashboardRoutes from "../routes/dashboard.js";
import authRoutes from "../routes/auth.js";
import { verify } from "./passport.js";
import redirectRouter from "../routes/redirect.js";
export function routes(app) {
  app.use("/dashboard", verify, dashboardRoutes);
  app.use("/", authRoutes);
  app.use("/", redirectRouter);

  app.get("*", (req, res) => {
    res.status(404).render("404");
  });
}
