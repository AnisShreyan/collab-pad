import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server as IOServer } from "socket.io";
import mongoose from "mongoose";
import authRoutes from "./routes/auth";
import docRoutes from "./routes/documents";
import shareRoutes from "./routes/share";
import { registerDocSocket } from "./sockets/doc";

const app = express();
const PORT = Number(process.env.PORT || 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/documents", docRoutes);
app.use("/api/share", shareRoutes);

const server = http.createServer(app);
const io = new IOServer(server, { cors: { origin: CLIENT_ORIGIN, credentials: true } });
registerDocSocket(io);

mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/collabpad")
  .then(() => {
    server.listen(PORT, () => console.log(`🚀 Collab pad server on :${PORT}`));
  })
  .catch((err) => {
    console.error("Mongo connection failed", err);
    process.exit(1);
  });
