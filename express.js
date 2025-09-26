import cors from "cors";
import express from "express";
import http from "http";
import adminRoutes from "./routes/adminRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import { initializeSocket } from "./services/socketService.js";
import { Server as SocketIOServer } from "socket.io";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});
app.use(cors());
app.use(express.json());

initializeSocket(io);
// initialze
app.use("/api/admin", adminRoutes);
app.use("/api/inventory", inventoryRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Middleware untuk parsing body request (untuk method POST)
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server berjalan pada http://localhost:${PORT}`);
});
