import { validationResult } from "express-validator";
import BorrowService from "../services/borrowService.js";

class BorrowController {
  static async submitBorrowRequest(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "validation error",
          errors: errors.array(),
        });
      }
      const result = await BorrowService.submitBorrowRequest(req.body);
      res.status(201).json({
        success: true,
        message:
          "Permintaan peminjaman berhasil disubmit. Silakan datang ke admin dalam 15 menit",
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  static async acceptBorrowRequest(req, res) {
    try {
      const { transactionId } = req.params;
      const adminId = req.admin.admin_id;

      const result = await BorrowService.acceptBorrowRequest(
        transactionId,
        adminId
      );

      res.json({
        success: true,
        message: "Permintaan peminjaman diterima",
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  static async processBarcodeScan(req, res) {
    try {
      const { barcode } = req.params;
      const itemData = await BorrowService.processBarcodeScan(barcode);

      res.json({
        success: true,
        message: "barcode berhasil dipindai",
        data: itemData,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  static async completeTransaction(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "validation error",
          errors: errors.array(),
        });
      }

      const { transactionId } = req.params;
      const { item_id, waktu_pengembalian } = req.body;
      const adminId = req.admin.admin_id;

      const result = await BorrowService.completeTransaction(
        transactionId,
        adminId,
        item_id,
        waktu_pengembalian
      );

      const response = {
        success: true,
        message: "Transaksi peminjaman berhasil diselesaikan",
        data: result,
      };

      res.json(response);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  static async rejectBorrowRequest(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "validation error",
          errors: errors.array(),
        });
      }

      const { transactionId } = req.params;
      const { alasan_penolakan } = req.body;
      const adminId = req.admin.admin_id;

      await BorrowService.rejectBorrowRequest(
        transactionId,
        adminId,
        alasan_penolakan
      );

      res.json({
        success: true,
        message: "Permintaan peminjaman ditolak",
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  static async directAdminLending(req, res) {
    try {
      const adminId = req.admin.admin_id;
      const lendingData = {
        ...req.body,
        admin_id: adminId,
      };

      const result = await BorrowService.directAdminLending(lendingData);

      res.json({
        success: true,
        message: "Peminjaman langsung dari admin berhasil",
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  static async getUserBorrowStatus(req, res) {
    try {
      const { nim } = req.params;
      const status = await BorrowService.getUserBorrowStatus(nim);
      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "gagal mengambil status peminjaman",
        error: error.message,
      });
    }
  }

  static async getPendingRequest(req, res) {
    try {
      const requests = await BorrowService.getPendingRequests();
      res.json({
        success: true,
        data: requests,
        count: requests.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Gagal mengambil data permintaan",
        error: error.message,
      });
    }
  }
}

export default BorrowController;
