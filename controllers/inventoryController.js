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
      console.log("Controller updateItem - ID:", req.params.id);
      console.log("Controller updateItem - Body:", req.body);

      const updated = await InventoryService.updateItem(
        req.params.id,
        req.body
      );

      console.log("Controller updateItem - Updated:", updated);

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: "tidak ditemukan",
        });
      }

      return res.json({
        success: true,
        message: "Item berhasil diupdate",
      });
    } catch (error) {
      if (!res.headersSent) {
        return res.status(400).json({
          success: false,
          message: "Gagal update item",
          error: error.message,
        });
      }
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
        message: "Gagal delete item",
      });
    }
  }
}

export default InventoryController;
