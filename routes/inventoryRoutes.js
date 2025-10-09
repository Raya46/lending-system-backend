import express from "express";
import InventoryController from "../controllers/inventoryController.js";
import authMiddleware from "../utils/authMiddleware.js";

const router = express.Router();
// public routes
router.get("/available", InventoryController.getAvailableItems);

router.post("/", authMiddleware, InventoryController.createItem);
router.put("/:id", authMiddleware, InventoryController.updateItem);
router.delete("/:id", authMiddleware, InventoryController.deleteItem);
router.get("/", authMiddleware, InventoryController.getAllItems);

export default router;
