import express from "express";
import AdminController from "../controllers/adminController.js";
import authMiddleware from "../utils/authMiddleware.js";

const router = express.Router();

router.post("/login", AdminController.login);

router.get(
  "/top-lending-items",
  authMiddleware,
  AdminController.getTopLendingItems
);
router.get(
  "/low-stock-items",
  authMiddleware,
  AdminController.getLowStockItems
);
router.get("/inventory", authMiddleware, AdminController.getInventoryData);
router.get(
  "/inventory-summary",
  authMiddleware,
  AdminController.getInventorySummary
);

router.get(
  "/classes-overview",
  authMiddleware,
  AdminController.getClassOverview
);
router.get("/classes-table", authMiddleware, AdminController.getClassTable);

router.get(
  "/get-mahasiswa-by-prodi/:nama_prodi",
  AdminController.getMahasiswaByProgramStudy
);

router.get("/current-loans", authMiddleware, AdminController.getCurrentLoans);
router.get(
  "/history-log",
  authMiddleware,
  AdminController.getAllBorrowTransactions
);
router.put(
  "/update-mahasiswa/:nim",
  authMiddleware,
  AdminController.updateMahasiswa
);
router.get("/classes/:id", authMiddleware, AdminController.getClassDetails);

// public routes
router.get("/classes", AdminController.getAllClasses);
router.get("/rooms", AdminController.getAllRooms);
router.get("/lecturers", AdminController.getAllLecturers);
router.get("/program-studies", AdminController.getAllProgramStudies);
router.get("/schedule-active", AdminController.getActiveSchedules);

export default router;
