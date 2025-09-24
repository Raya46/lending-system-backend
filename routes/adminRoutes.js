import express from "express";
import AdminController from "../controllers/adminController.js";

const router = express.Router();

router.post("/login", AdminController.login);

router.get("/dashboard/top-lending-items", AdminController.getTopLendingItems);
router.get("/dashboard/low-stock-items", AdminController.getLowStockItems);
router.get("/dashboard/inventory-data", AdminController.getInventoryData);
router.get("/dashboard/inventory-summary", AdminController.getInventorySummary);

export default router;
