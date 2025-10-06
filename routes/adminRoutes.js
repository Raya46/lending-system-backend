import express from "express";
import AdminController from "../controllers/adminController.js";

const router = express.Router();

router.post("/login", AdminController.login);

router.get("/top-lending-items", AdminController.getTopLendingItems);
router.get("/low-stock-items", AdminController.getLowStockItems);
router.get("/inventory", AdminController.getInventoryData);
router.get("/inventory-summary", AdminController.getInventorySummary);

router.get("/classes-overview", AdminController.getClassOverview);
router.get("/classes-table", AdminController.getClassTable);

router.get(
  "/get-mahasiswa-by-prodi/:nama_prodi",
  AdminController.getMahasiswaByProgramStudy
);

router.get("/current-loans", AdminController.getCurrentLoans);
router.get("/history-log", AdminController.getAllBorrowTransactions);
router.put("/update-mahasiswa/:nim", AdminController.updateMahasiswa);

router.get("/classes", AdminController.getAllClasses);
router.get("/rooms", AdminController.getAllRooms);
router.get("/lecturers", AdminController.getAllLecturers);
router.get("/program-studies", AdminController.getAllProgramStudies);

export default router;
