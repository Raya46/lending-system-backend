import { validationResult } from "express-validator";
import AdminService from "../services/adminService.js";
// const AdminService = require("../services/adminService");
class AdminController {
  static async login(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          succes: false,
          message: "validation error",
          errors: errors.array(),
        });
      }

      const { username, password } = req.body;
      const result = await AdminService.login(username, password);

      res.json({
        succes: true,
        message: "login berhasil",
        data: result,
      });
    } catch (error) {
      res.status(401).json({
        succes: false,
        message: error.message,
      });
    }
  }

  static async getTopLendingItems(req, res) {
    try {
      const items = await AdminService.getTopLendingItems();
      res.json({
        success: true,
        data: items,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Gagal mengambil data top lending items",
        error: error.message,
      });
    }
  }

  static async getLowStockItems(req, res) {
    try {
      const items = await AdminService.getLowStockItems();
      res.json({
        success: true,
        data: items,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Gagal mengambil data low stock items",
        error: error.message,
      });
    }
  }

  static async getInventorySummary(req, res) {
    try {
      const summary = await AdminService.getInventorySummary();
      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Gagal mengambil data inventory summary",
        error: error.message,
      });
    }
  }

  static async getInventoryData(req, res) {
    try {
      const inventory = await AdminService.getInventoryData();
      res.json({
        success: true,
        data: inventory,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Gagal mengambil inventory data",
        error: error.message,
      });
    }
  }
}

export default AdminController;
