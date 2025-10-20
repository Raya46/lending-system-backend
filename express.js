import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import adminRoutes from "./routes/adminRoutes.js";
import borrowRoutes from "./routes/borrowRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import { initializeSocket } from "./services/socketService.js";
import {
  autoRejectAllExpiredRequests,
  updateOverdueItems,
  autoReturnOverdueItems,
} from "./utils/borrowUtils.js";

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
app.use("/api/borrow", borrowRoutes);

setInterval(async () => {
  try {
    await updateOverdueItems();
    await autoRejectAllExpiredRequests();
    await autoReturnOverdueItems(); // Auto-return items that have passed their due time
  } catch (error) {
    console.error("Error running overdue items update job:", error);
  }
}, 2 * 60 * 1000); // Reduced from 10 minutes to 2 minutes for more responsive detection

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Middleware untuk parsing body request (untuk method POST)
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server berjalan pada http://localhost:${PORT}`);
});
