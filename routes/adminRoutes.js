import express from "express";
import AdminController from "../controllers/adminController.js";
import authMiddleware from "../utils/authMiddleware.js";
import multer from "multer";
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.match(/\.(xlsx|xls)$/i)
    ) {
      cb(null, true);
    } else {
      cb(new Error("only excel files are allowed"));
    }
  },
});

router.post("/login", AdminController.login);

router.post(
  "/import-excel",
  authMiddleware,
  upload.single("excelFile"),
  AdminController.importMahasiswa
);

router.get(
  "/top-lending-items",
  authMiddleware,
  AdminController.getTopLendingItems
);
router.get(
  "/low-stock-items",
  authMiddleware,
  AdminController.getLowStockItems
);
router.get("/inventory", authMiddleware, AdminController.getInventoryData);
router.get(
  "/inventory-summary",
  authMiddleware,
  AdminController.getInventorySummary
);

router.get(
  "/classes-overview",
  authMiddleware,
  AdminController.getClassOverview
);
router.get("/classes-table", authMiddleware, AdminController.getClassTable);

router.get(
  "/get-mahasiswa-by-prodi/:nama_prodi",
  AdminController.getMahasiswaByProgramStudy
);

router.get("/current-loans", authMiddleware, AdminController.getCurrentLoans);
router.get(
  "/history-log",
  authMiddleware,
  AdminController.getAllBorrowTransactions
);
router.put(
  "/update-mahasiswa/:nim",
  authMiddleware,
  AdminController.updateMahasiswa
);
router.get("/classes/:id", authMiddleware, AdminController.getClassDetails);
router.post("/return-item", authMiddleware, AdminController.returnItem);
router.post(
  "/return-item-by-transaction",
  authMiddleware,
  AdminController.returnItemByTransaction
);

// public routes
router.get("/classes", AdminController.getAllClasses);
router.get("/rooms", AdminController.getAllRooms);
router.get("/lecturers", AdminController.getAllLecturers);
router.get("/program-studies", AdminController.getAllProgramStudies);
router.get("/schedule-active", AdminController.getActiveSchedules);

export default router;
