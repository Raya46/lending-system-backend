import { body } from "express-validator";

const borrowRequestValidation = [
  // Validasi untuk mahasiswa (jika ada)
  body("nama_mahasiswa")
    .if(body("nama_mahasiswa").exists())
    .notEmpty()
    .withMessage("Nama mahasiswa harus diisi")
    .isLength({ min: 2, max: 255 })
    .withMessage("Nama mahasiswa harus antara 2-255 karakter"),
  body("nim_mahasiswa")
    .if(body("nim_mahasiswa").exists())
    .notEmpty()
    .withMessage("NIM harus diisi")
    .isLength({ min: 5, max: 50 })
    .withMessage("NIM harus 5 karakter atau lebih"),

  // Validasi untuk dosen (jika ada)
  body("nama_dosen")
    .if(body("nama_dosen").exists())
    .notEmpty()
    .withMessage("Nama dosen harus diisi")
    .isLength({ min: 2, max: 255 })
    .withMessage("Nama dosen harus 2 karakter atau lebih"),
  body("nip_dosen")
    .if(body("nip_dosen").exists())
    .notEmpty()
    .withMessage("NIP dosen harus diisi")
    .isLength({ min: 5, max: 50 })
    .withMessage("NIP harus 5 karakter atau lebih"),

  // Validasi wajib untuk semua jenis peminjaman
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

  // Custom validation: harus ada mahasiswa atau dosen
  body().custom((value, { req }) => {
    const hasStudent = req.body.nama_mahasiswa && req.body.nim_mahasiswa;
    const hasLecturer = req.body.nama_dosen && req.body.nip_dosen;

    if (!hasStudent && !hasLecturer) {
      throw new Error(
        "Harus ada data mahasiswa (nama dan NIM) atau dosen (nama dan NIP)"
      );
    }

    if (hasStudent && hasLecturer) {
      throw new Error(
        "Tidak bisa mengajukan peminjaman untuk mahasiswa dan dosen secara bersamaan"
      );
    }

    return true;
  }),
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
