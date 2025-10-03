import express from "express";
import {
  borrowRequestValidation,
  completeTransactionValidation,
} from "../utils/validation.js";
import BorrowController from "../controllers/borrowController.js";

const router = express.Router();

router.post(
  "/request",
  borrowRequestValidation,
  BorrowController.submitBorrowRequest
);

router.get("/pending-requests", BorrowController.getPendingRequest);
router.get("/status/:nim", BorrowController.getUserBorrowStatus);
router.get("/scan/:barcode", BorrowController.processBarcodeScan);
router.put(
  "/complete/:transactionId",
  completeTransactionValidation,
  BorrowController.completeTransaction
);

router.put("/accept/:transactionId", BorrowController.acceptBorrowRequest);
router.put("/reject/:transactionId", BorrowController.rejectBorrowRequest);
router.post("/direct-lending", BorrowController.directAdminLending);

export default router;
