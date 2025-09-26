import express from "express";
import InventoryController from "../controllers/inventoryController.js";

const router = express.Router();

router.get("/get-available-items", InventoryController.getAvailableItems);
router.post("/create-item", InventoryController.createItem);
router.put("/update-item/:id", InventoryController.updateItem);
router.delete("/delete-item/:id", InventoryController.deleteItem);

export default router;
