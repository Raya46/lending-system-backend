import InventoryService from "../services/inventoryService.js";

class InventoryController {
  static async getAllItems(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const result = await InventoryService.getAllItems(
        parseInt(limit),
        offset
      );

      res.json({
        success: true,
        data: result.data,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total: result.total,
          total_pages: Math.ceil(result.total / parseInt(limit)),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Gagal mengambil data inventory",
        error: error.message,
      });
    }
  }

  static async getAvailableItems(req, res) {
    try {
      const items = await InventoryService.getAvailableItems();
      res.json({
        success: true,
        data: items,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Gagal mengambil data available item",
        error: error.message,
      });
    }
  }

  static async createItem(req, res) {
    try {
      const itemData = req.body;
      const itemCreated = await InventoryService.createItem(itemData);
      res.status(201).json({
        success: true,
        message: "Item berhasil ditambahkan",
        data: itemCreated,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: "Gagal menambahkan item",
        error: error.message,
      });
    }
  }

  static async updateItem(req, res) {
    try {
      const itemId = req.params.id;
      const itemData = req.body;
      const itemUpdated = await InventoryService.updateItem(itemId, itemData);
      res.json({
        success: true,
        message: "Item berhasil di update",
        data: itemUpdated,
      });
    } catch (error) {
      res.json(400).json({
        success: false,
        message: "Gagal mengupdate item",
        error: error.message,
      });
    }
  }

  static async deleteItem(req, res) {
    try {
      const itemId = req.params.id;
      const itemDeleted = await InventoryService.deleteItem(itemId);
      res.json({
        success: true,
        message: "Berhasil delete",
        data: itemDeleted,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: "Gagal mengupdate item",
      });
    }
  }
}

export default InventoryController;
