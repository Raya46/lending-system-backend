import express from "express";
import {
  borrowRequestValidation,
  completeTransactionValidation,
} from "../utils/validation.js";
import BorrowController from "../controllers/borrowController.js";
import authMiddleware from "../utils/authMiddleware.js";

const router = express.Router();

router.post(
  "/request",
  borrowRequestValidation,
  BorrowController.submitBorrowRequest
);
router.get("/status/:nim", BorrowController.getUserBorrowStatus);

router.get("/pending-requests", BorrowController.getPendingRequest);
router.get(
  "/scan/:barcode",
  authMiddleware,
  BorrowController.processBarcodeScan
);
router.put(
  "/complete/:transactionId",
  authMiddleware,
  completeTransactionValidation,
  BorrowController.completeTransaction
);

router.put(
  "/accept/:transactionId",
  authMiddleware,
  BorrowController.acceptBorrowRequest
);
router.put(
  "/reject/:transactionId",
  authMiddleware,
  BorrowController.rejectBorrowRequest
);
router.post(
  "/direct-lending",
  authMiddleware,
  BorrowController.directAdminLending
);

export default router;
