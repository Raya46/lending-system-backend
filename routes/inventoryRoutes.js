import express from "express";
import InventoryController from "../controllers/inventoryController.js";

const router = express.Router();

router.get("/available", InventoryController.getAvailableItems);
router.post("/", InventoryController.createItem);
router.put("/:id", InventoryController.updateItem);
router.delete("/:id", InventoryController.deleteItem);
router.get("/", InventoryController.getAllItems);

export default router;
