import { validationResult } from "express-validator";
import AdminService from "../services/adminService.js";
class AdminController {
  static async login(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "validation error",
          errors: errors.array(),
        });
      }

      const { username, password } = req.body;
      const result = await AdminService.login(username, password);

      res.json({
        success: true,
        message: "login berhasil",
        data: result,
      });
    } catch (error) {
      res.status(401).json({
        success: false,
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
      const { page = 1, limit = 10 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const inventoryResult = await AdminService.getInventoryData(
        parseInt(limit),
        offset
      );
      res.json({
        success: true,
        data: inventoryResult.data,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total_items: inventoryResult.total,
          total_pages: Math.ceil(inventoryResult.total / parseInt(limit)),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Gagal mengambil inventory data",
        error: error.message,
      });
    }
  }

  static async getClassOverview(req, res) {
    try {
      const classData = await AdminService.getClassOverview();
      res.json({
        success: true,
        data: classData,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Gagal mengambil class data",
        error: error.message,
      });
    }
  }

  static async getClassTable(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const result = await AdminService.getClassesTable(
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
        message: "Gagal mengambil class table data",
        error: error.message,
      });
    }
  }

  static async getMahasiswaByProgramStudy(req, res) {
    try {
      const { nama_prodi } = req.params;
      const { limit = 10, offset = 0 } = req.query;
      const results = await AdminService.getMahasiswaByProgramStudy(
        nama_prodi,
        parseInt(limit),
        parseInt(offset)
      );
      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      const statusCode = error.message.includes("tidak ditemukan") ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message,
      });
    }
  }

  static async updateMahasiswa(req, res) {
    try {
      const { nim } = req.params;
      const mahasiswaData = req.body;
      const result = await AdminService.updateMahasiswa(nim, mahasiswaData);
      res.json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  static async getCurrentLoans(req, res) {
    try {
      const loans = await AdminService.getCurrentLoans();
      res.json({ success: true, data: loans });
    } catch (error) {
      res.status(500).json({
        sucess: false,
        message: "gagal mengambil data current loans",
        error: error.message,
      });
    }
  }

  static async getAllBorrowTransactions(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const result = await AdminService.getAllBorrowTransactions(
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
        message: "gagal mengambil semua data transaksi",
        error: error.message,
      });
    }
  }

  static async getAllClasses(req, res) {
    try {
      const classes = await AdminService.getAllClasses();
      res.json({ success: true, data: classes });
    } catch (error) {
      res.status(500).json({
        sucess: false,
        message: "gagal mengambil data class",
        error: error.message,
      });
    }
  }
  static async getAllRooms(req, res) {
    try {
      const rooms = await AdminService.getAllRooms();
      res.json({ success: true, data: rooms });
    } catch (error) {
      res.status(500).json({
        sucess: false,
        message: "gagal mengambil data rooms",
        error: error.message,
      });
    }
  }
  static async getAllLecturers(req, res) {
    try {
      const lecturers = await AdminService.getAllLecturers();
      res.json({ success: true, data: lecturers });
    } catch (error) {
      res.status(500).json({
        sucess: false,
        message: "gagal mengambil data Lecturers",
        error: error.message,
      });
    }
  }
  static async getAllProgramStudies(req, res) {
    try {
      const programStudies = await AdminService.getAllProgramStudies();
      res.json({ success: true, data: programStudies });
    } catch (error) {
      res.status(500).json({
        sucess: false,
        message: "gagal mengambil data ProgramStudies",
        error: error.message,
      });
    }
  }
  static async getClassDetails(req, res) {
    try {
      const classDetails = await AdminService.getClassDetails(req.params.id);
      if (!classDetails) {
        return res.status(404).json({
          success: false,
          message: "Kelas tidak ditemukan",
        });
      }
      res.json({
        success: true,
        data: classDetails,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Gagal mengambil detail kelas",
        error: error.message,
      });
    }
  }

  static async getActiveSchedules(req, res) {
    try {
      const schedules = await AdminService.getActiveSchedules();
      res.json({
        success: true,
        data: schedules,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Gagal mengambil data jadwal aktif",
        error: error.message,
      });
    }
  }

  static async returnItem(req, res) {
    try {
      const { barcode } = req.body;
      const adminId = req.admin.admin_id;

      if (!barcode) {
        return res.status(400).json({
          success: false,
          message: "Barcode is required",
        });
      }

      const result = await AdminService.returnItemByBarcode(barcode, adminId);

      res.json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  static async returnItemByTransaction(req, res) {
    try {
      const { transactionId, notes } = req.body;
      const adminId = req.admin.admin_id;

      if (!transactionId) {
        return res.status(400).json({
          success: false,
          message: "Transaction ID is required",
        });
      }

      const result = await AdminService.returnItem(
        transactionId,
        adminId,
        notes
      );

      res.json({
        success: true,
        message: "Item returned successfully",
        data: result.transaction,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  static async importMahasiswa(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "File excel harus diupload",
        });
      }

      if (
        !req.file.mimetype.includes("spreadsheet") &&
        !req.file.originalname.match(/\.(xlsx|xls)$/i)
      ) {
        return res.status(400).json({
          success: false,
          message: "file harus berformat excel (.xlsx atau .xls)",
        });
      }

      const { nama_prodi, templateType } = req.body;

      const result = await AdminService.importMahasiswa(
        req.file.buffer,
        nama_prodi,
        templateType
      );

      res.status(201).json({
        success: true,
        message: `import selesai: ${result.successful_imports} berhasil, ${result.failed_imports} gagal`,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export default AdminController;
