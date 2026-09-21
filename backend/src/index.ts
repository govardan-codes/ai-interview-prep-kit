import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { connectDB } from "./config/db";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth.routes";
import kitRoutes from "./routes/kit.routes";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000", credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.use(
  "/api",
  rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false })
);

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/kits", kitRoutes);

app.use(errorHandler);

const PORT = process.env.PORT ?? 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Backend listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
