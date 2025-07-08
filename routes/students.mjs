import express from "express";
import multer from "multer";
import xlsx from "xlsx";
import fs from "fs";
import {
  detectFileType,
  parsePerSheet,
  parsePerColumn,
} from "../ultils/excelParser.mjs";

const router = express.Router();
const upload = multer({ dest: "uploads/" });


/*
    Middleware Multer untuk menangani file upload dan error handingnya juga
    dokumentasi: https://expressjs.com/en/resources/middleware/multer.html
*/

// Route untuk menangani upload file ke /api/students/upload
router.post("/upload", (req, res) => {
  // Middleware untuk menangani file upload menggunakan multer
  const uploader = upload.single("studentFile");
  uploader(req, res, function (err) {


    // ===============================================================
    // --- buat error handling dr multer DARI SINI ---
    // ===============================================================

    if (err instanceof multer.MulterError) {
      return res.status(500).json({ message: "File upload error", error: err });
    } else if (err) {
      return res
        .status(500)
        .json({ message: "An unknown error occurred", error: err });
    }

    // ===============================================================
    // ------------ SAMPAI SINI ---
    // ===============================================================

    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }
    //sampai sini error handlingnya

    // Hasil input programStudi dari the UI
    const { programStudi } = req.body;
    const filePath = req.file.path;
    console.log(
      `[INFO] File uploaded: ${req.file.originalname}, size: ${req.file.size} bytes`
    );

    try {
      //baca file excel
      const workbook = xlsx.readFile(filePath);
      //bikin penampungan data mahasiswa dalam bentuk array buat data excel
      let allStudents = [];
      const detectedType = detectFileType(workbook);
      console.log(`[INFO] Auto-detected file type as: ${detectedType}`);

      // =================================================================
      // --- LOGIC CARA PARSING DARI TIPENYA ---
      // =================================================================
      if (detectedType === "perSheet") {
        allStudents = parsePerSheet(workbook);
      } else if (detectedType === "perColumn") {
        allStudents = parsePerColumn(workbook, programStudi);
      }

      // ===============================================================
      // --- GROUPING LOGIC DARI SINI ---
      // ===============================================================
      const groupedStudents = {};
      for (const student of allStudents) {
        // class_group ngambil dari variable obeject student 
        const { class_group } = student;

        // buat empty array jika belum melihat class_group ini sebelumnya
        if (!groupedStudents[class_group]) {
          groupedStudents[class_group] = [];
        }

        // push student ke dalam array class_group dan ambil nim dan name
        groupedStudents[class_group].push({
          nim: student.nim,
          name: student.name,
        });
      }
      // ===============================================================
      // ------------ SAMPAI SINI ---
      // ===============================================================

      console.log(
        "✅ Total students processed in backend:",allStudents.length
      );

      res.status(200).json({
        message: "File parsed and students grouped successfully!",
        fileName: req.file.originalname,
        totalStudentsFound: allStudents.length,
        dataByClass: groupedStudents, // mengirim data tergroup terbaru
      });
    } catch (error) {
      console.error("Error processing file:", error);
      res.status(500).send("An error occurred while processing the file.");
    } finally {
      if (req.file) {
        // hapus file yang sudah diupload
        fs.unlinkSync(req.file.path);
      }
    }
  });
});

export default router;
