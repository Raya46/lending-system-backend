import express from "express";
import AdminController from "../controllers/adminController.js";

const router = express.Router();

router.post("/login", AdminController.login);

router.get("/top-lending-items", AdminController.getTopLendingItems);
router.get("/low-stock-items", AdminController.getLowStockItems);
router.get("/inventory-data", AdminController.getInventoryData);
router.get("/inventory-summary", AdminController.getInventorySummary);

router.get("/class-overview", AdminController.getClassOverview);
router.get("/class-table", AdminController.getClassTable);

router.get(
  "/get-mahasiswa-by-prodi/:nama_prodi",
  AdminController.getMahasiswaByProgramStudy
);
router.put("/update-mahasiswa/:nim", AdminController.updateMahasiswa);

export default router;
