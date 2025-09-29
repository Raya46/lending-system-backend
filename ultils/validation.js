import { body } from "express-validator";

const borrowRequestValidation = [
  body("nama_mahasiswa")
    .notEmpty()
    .withMessage("Nama harus diisi")
    .isLength({ min: 2, max: 255 })
    .withMessage("Nama mahasiswa harus antara 2-255 karakter"),
  body("nim_mahasiswa")
    .notEmpty()
    .withMessage("NIM harus diisi")
    .isLength({ min: 5, max: 50 })
    .withMessage("NIM harus 5 karakter atau lebih"),
  body("nama_dosen")
    .notEmpty()
    .withMessage("Nama dosen harus diisi")
    .isLength({ min: 2, max: 255 })
    .withMessage("Nama dosen harus 2 karakter atau lebih"),
  body("kelas")
    .notEmpty()
    .withMessage("Nama kelas/mata kuliah harus diisi")
    .isLength({ min: 2, max: 100 })
    .withMessage("Nama kelas harus 2 karakter atau lebih"),
  body("nama_prodi")
    .notEmpty()
    .withMessage("Nama program studi harus diisi")
    .isLength({ min: 2, max: 50 })
    .withMessage("Nama prodi harus 2 karakter atau lebih"),
  body("jadwal_id")
    .isInt({ min: 1 })
    .withMessage("ID jadwal harus berupa integer"),
  body("waktu_pengembalian_dijanjikan")
    .notEmpty()
    .withMessage("Waktu pengembalian harus diisi")
    .isISO8601()
    .withMessage("Waktu pengembalian harus dalam format datetime yang valid"),
  body("id_barang")
    .isInt({ min: 1 })
    .withMessage("ID barang harus berupa angka yang valid"),
];

const completeTransactionValidation = [
  body("item_id")
    .isInt({ min: 1 })
    .withMessage("ID item harus berupa angka yang valid"),
  body("waktu_pengembalian")
    .notEmpty()
    .withMessage("Waktu pengembalian harus diisi")
    .isISO8601()
    .withMessage("Waktu pengembalian harus dalam format datetime yang valid"),
];

const rejectRequestValidation = [
  body("alasan_penolakan")
    .notEmpty()
    .withMessage("Alasan penolakan harus diisi")
    .isLength({ min: 5, max: 500 })
    .withMessage("Alasan penolakan harus 5 karakter lebih"),
];

export {
  borrowRequestValidation,
  completeTransactionValidation,
  rejectRequestValidation,
};
