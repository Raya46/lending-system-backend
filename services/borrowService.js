import pool from "../data/db_setting.js";
import {
  autoRejectExpiredRequest,
  validateBorrowEligibility,
  validateLecturerBorrowEligibility,
} from "../utils/borrowUtils.js";
import { emitToAdmins, emitToStudent } from "./socketService.js";

class BorrowService {
  static async submitBorrowRequest(requestData) {
    const {
      nama_mahasiswa,
      nim_mahasiswa,
      nama_dosen,
      nip_dosen,
      kelas,
      nama_prodi,
      jadwal_id,
      waktu_pengembalian_dijanjikan,
      id_barang,
    } = requestData;

    // Determine borrower and validate schedule eligibility
    let borrowerNim, borrowerNip, borrowerName, borrowerType;

    if (nama_mahasiswa && nim_mahasiswa) {
      borrowerType = "student";
      borrowerNim = nim_mahasiswa;
      borrowerNip = null;
      borrowerName = nama_mahasiswa;
    } else if (nama_dosen && nip_dosen) {
      borrowerType = "lecturer";
      borrowerNim = null;
      borrowerNip = nip_dosen;
      borrowerName = nama_dosen;
    } else {
      throw new Error(
        "Informasi peminjam tidak lengkap. Harus ada mahasiswa (nama dan NIM) atau dosen (nama dan NIP)"
      );
    }

    const connection = await pool.getConnection();

    // Validate schedule eligibility (for both students and lecturers)
    if (borrowerType === "student") {
      await validateBorrowEligibility(
        nim_mahasiswa,
        jadwal_id,
        waktu_pengembalian_dijanjikan
      );
    } else if (borrowerType === "lecturer") {
      // Validate lecturer schedule eligibility
      await validateLecturerBorrowEligibility(
        nip_dosen,
        jadwal_id,
        waktu_pengembalian_dijanjikan
      );
    }

    try {
      await connection.beginTransaction();

      await connection.execute(
        "SELECT nama_prodi FROM prodi WHERE nama_prodi = ?",
        [nama_prodi]
      );

      if (borrowerType === "student") {
        await connection.execute("SELECT nim FROM mahasiswa WHERE nim = ?", [
          nim_mahasiswa,
        ]);
      } else {
        const [existingLecturer] = await connection.execute(
          "SELECT nip FROM dosen WHERE nip = ?",
          [nip_dosen]
        );

        if (existingLecturer.length === 0) {
          throw new Error(
            `Dosen dengan NIP ${nip_dosen} tidak ditemukan dalam database`
          );
        }
      }

      // 3. Find or create lecturer
      let lecturerNIP;
      const [existingLecturer] = await connection.execute(
        "SELECT nip FROM dosen WHERE nama_dosen = ?",
        [nama_dosen]
      );

      lecturerNIP = existingLecturer[0].nip;

      // 4. Find or create class
      let classId;
      const [existingClass] = await connection.execute(
        "SELECT id_kelas FROM kelas WHERE nama_kelas = ?",
        [kelas]
      );

      classId = existingClass[0].id_kelas;

      // 5. Check if borrower already has a pending transaction
      let pendingCheckQuery, pendingCheckParams;
      if (borrowerType === "student") {
        pendingCheckQuery = `SELECT peminjaman_id FROM transaksi
         WHERE nim = ? AND status_peminjaman IN ('pending', 'accepted')
         AND waktu_pengembalian_dijanjikan > NOW()`;
        pendingCheckParams = [borrowerNim];
      } else {
        pendingCheckQuery = `SELECT peminjaman_id FROM transaksi
         WHERE nip = ? AND status_peminjaman IN ('pending', 'accepted')
         AND waktu_pengembalian_dijanjikan > NOW()`;
        pendingCheckParams = [borrowerNip];
      }

      const [pendingCheck] = await connection.execute(
        pendingCheckQuery,
        pendingCheckParams
      );

      if (pendingCheck.length > 0) {
        throw new Error(
          "Anda masih memiliki permintaan pending yang belum selesai"
        );
      }

      // 6. Create pending transaction
      const returnDateTime = new Date(waktu_pengembalian_dijanjikan);
      const countdownExpiry = new Date();
      countdownExpiry.setMinutes(countdownExpiry.getMinutes() + 15);

      const requestMetadata = {
        borrower_type: borrowerType,
        lecturer_nip: lecturerNIP,
        lecturer_name: nama_dosen || null,
        original_nim: borrowerType === "lecturer" ? nip_dosen : nim_mahasiswa,
        original_name: borrowerName,
        class_name: kelas,
        class_id: classId,
        countdown_expiry: countdownExpiry.toISOString(),
        actual_return_date: returnDateTime.toISOString(),
        request_type: "borrow_request",
        validation_passed: true,
      };

      // Insert with pending status - waiting for admin acceptance
      const [transactionResult] = await connection.execute(
        `INSERT INTO transaksi
          (nim, nip, jadwal_id, id_barang, waktu_pengembalian_dijanjikan, status_peminjaman, notes_checkout, nama_prodi)
          VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [
          borrowerNim,
          borrowerNip,
          jadwal_id,
          id_barang,
          returnDateTime.toISOString().slice(0, 19).replace("T", " "),
          JSON.stringify(requestMetadata),
          nama_prodi,
        ]
      );

      const transactionId = transactionResult.insertId;
      await connection.commit();

      // Get complete request data for notification
      let requestDataQuery, requestDataJoin;
      if (borrowerType === "student") {
        requestDataQuery = `SELECT
          t.peminjaman_id,
          t.nim,
          m.nama_mahasiswa as nama_peminjam,
          p.nama_prodi,
          t.waktu_pengembalian_dijanjikan as expires_at,
          t.notes_checkout,
          t.created_at,
          i.tipe_nama_barang,
          i.barcode
        FROM transaksi t
        JOIN mahasiswa m ON t.nim = m.nim
        JOIN prodi p ON m.nama_prodi = p.nama_prodi
        LEFT JOIN inventory i ON t.id_barang = i.id_barang
        WHERE t.peminjaman_id = ?`;
        requestDataJoin = [transactionId];
      } else {
        requestDataQuery = `SELECT
          t.peminjaman_id,
          t.nip,
          d.nama_dosen as nama_mahasiswa,
          p.nama_prodi,
          t.waktu_pengembalian_dijanjikan as expires_at,
          t.notes_checkout,
          t.created_at,
          i.tipe_nama_barang,
          i.barcode
        FROM transaksi t
        JOIN dosen d ON t.nip = d.nip
        JOIN prodi p ON t.nama_prodi = p.nama_prodi
        LEFT JOIN inventory i ON t.id_barang = i.id_barang
        WHERE t.peminjaman_id = ?`;
        requestDataJoin = [transactionId];
      }

      const [requestDataResult] = await connection.execute(
        requestDataQuery,
        requestDataJoin
      );

      const metadata = JSON.parse(requestDataResult[0].notes_checkout);
      const completeRequestData = {
        ...requestDataResult[0],
        lecturer_name: metadata.lecturer_name,
        class_name: metadata.class_name,
        expiry_time: requestDataResult[0].expires_at,
      };

      // Emit to admins - request needs acceptance first
      emitToAdmins("new_borrow_request", {
        ...completeRequestData,
        countdown_minutes: 15,
        request_type: "borrow_request",
        status: "awaiting_acceptance",
      });

      // Set auto-rejection timer
      setTimeout(async () => {
        await autoRejectExpiredRequest(transactionId);
      }, 15 * 60 * 1000);

      return {
        transaction_id: transactionId,
        request_data: completeRequestData,
        return_datetime: returnDateTime.toISOString(),
        status: "pending_acceptance",
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async acceptBorrowRequest(transactionId, adminId) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      let transactionQuery;
      const metadataCheck = await connection.execute(
        "SELECT notes_checkout FROM transaksi WHERE peminjaman_id = ?",
        [transactionId]
      );

      if (metadataCheck.length > 0) {
        // Tambahkan pengecekan untuk menghindari error jika notes_checkout undefined
        if (!metadataCheck[0][0].notes_checkout) {
          console.error(
            "Error: notes_checkout is undefined for transaction:",
            metadataCheck[0][0]
          );
          throw new Error(
            "Data transaksi tidak lengkap - notes_checkout tidak ditemukan"
          );
        }

        const metadata = JSON.parse(metadataCheck[0][0].notes_checkout);
        if (metadata.borrower_type === "lecturer") {
          transactionQuery = `SELECT t.*,d.nama_dosen as nama_peminjam
            FROM transaksi t
            JOIN dosen d ON t.nip = d.nip
            WHERE t.peminjaman_id = ? AND t.status_peminjaman = 'pending'`;
        } else {
          transactionQuery = `SELECT t.*, m.nama_mahasiswa as nama_peminjam
            FROM transaksi t
            JOIN mahasiswa m ON t.nim = m.nim
            WHERE t.peminjaman_id = ? AND t.status_peminjaman = 'pending'`;
        }
      } else {
        transactionQuery = `SELECT t.*, m.nama_mahasiswa as nama_peminjam
            FROM transaksi t
            JOIN mahasiswa m ON t.nim = m.nim
            WHERE t.peminjaman_id = ? AND t.status_peminjaman = 'pending'`;
      }

      const [transactionData] = await connection.execute(transactionQuery, [
        transactionId,
      ]);

      if (transactionData.length === 0) {
        throw new Error("Transaksi tidak ditemukan atau sudah diproses");
      }

      const transaction = transactionData[0];

      // Tambahkan pengecekan untuk menghindari error jika notes_checkout undefined
      if (!transaction.notes_checkout) {
        console.error(
          "Error: notes_checkout is undefined for transaction:",
          transaction
        );
        throw new Error(
          "Data transaksi tidak lengkap - notes_checkout tidak ditemukan"
        );
      }

      const metadata = JSON.parse(transaction.notes_checkout);

      await connection.execute(
        `
        UPDATE transaksi
        SET status_peminjaman = 'accepted',
            admin_id_checkout = ?,
            notes_checkout = ?
        WHERE peminjaman_id = ?
        `,
        [
          adminId,
          JSON.stringify({
            ...metadata,
            accepted_at: new Date().toISOString(),
            accepted_by_admin: adminId,
            student_arrived_at: new Date().toISOString(),
            status: "ready_for_barcode_scan",
          }),
          transactionId,
        ]
      );

      await connection.commit();

      const borrowerTypeMessageStudent =
        metadata.borrower_type === "lecturer" ? "dosen" : "mahasiswa";
      const borrowerIdentifier = transaction.nim || transaction.nip;

      emitToStudent(borrowerIdentifier, "borrow_accepted", {
        transaction_id: transactionId,
        message: `Permintaan peminjaman Anda (${borrowerTypeMessageStudent}) telah diterima! Admin akan memproses peminjaman.`,
        lecturer_name: metadata.lecturer_name,
        class_name: metadata.class_name,
        borrower_type: metadata.borrower_type,
        admin_id: adminId,
      });

      const borrowerTypeMessageAdmin =
        metadata.borrower_type === "lecturer" ? "dosen" : "mahasiswa";

      emitToAdmins("student_arrived", {
        transaction_id: transactionId,
        borrower_name: transaction.nama_peminjam,
        borrower_nim: transaction.nim,
        borrower_nip: transaction.nip,
        borrower_type: metadata.borrower_type,
        message: `${borrowerTypeMessageAdmin} ${transaction.nama_peminjam} sudah tiba di meja admin. Silahkan scan barcode barang`,
        ready_for_barcode_scan: true,
      });

      return {
        success: true,
        message: "Request accepted, pleas scan barcode in item",
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async processBarcodeScan(barcode) {
    const [itemData] = await pool.execute(
      `
        SELECT * FROM inventory 
        WHERE barcode = ? AND status = 'tersedia'
        `,
      [barcode]
    );

    if (itemData.length === 0) {
      throw new Error("Barcode tidak ditemukan atau item tidak tersedia");
    }
    return itemData[0];
  }

  static async completeTransaction(
    transactionId,
    adminId,
    itemId,
    waktuPengembalian
  ) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const returnDateTime = new Date(waktuPengembalian);
      const mysqlDateTime = returnDateTime
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

      let transactionQuery;
      const metadataCheck = await connection.execute(
        "SELECT notes_checkout FROM transaksi WHERE peminjaman_id = ?",
        [transactionId]
      );

      if (metadataCheck.length > 0) {
        // Tambahkan pengecekan untuk menghindari error jika notes_checkout undefined
        if (!metadataCheck[0][0].notes_checkout) {
          console.error(
            "Error: notes_checkout is undefined for transaction:",
            metadataCheck[0][0]
          );
          throw new Error(
            "Data transaksi tidak lengkap - notes_checkout tidak ditemukan"
          );
        }

        const metadata = JSON.parse(metadataCheck[0][0].notes_checkout);
        if (metadata.borrower_type === "lecturer") {
          transactionQuery = `SELECT t.*, d.nama_dosen as nama_peminjam, p.nama_prodi
        FROM transaksi t
        JOIN dosen d ON t.nip = d.nip
        JOIN prodi p ON d.prodi = p.nama_prodi
        WHERE t.peminjaman_id = ?
            AND t.status_peminjaman = 'accepted'
        `;
        } else {
          transactionQuery = `SELECT t.*, m.nama_mahasiswa as nama_peminjam, p.nama_prodi
        FROM transaksi t
        JOIN mahasiswa m ON t.nim = m.nim
        JOIN prodi p ON m.nama_prodi = p.nama_prodi
        WHERE t.peminjaman_id = ?
            AND t.status_peminjaman = 'accepted'
        `;
        }
      } else {
        transactionQuery = `SELECT t.*, m.nama_mahasiswa as nama_peminjam, p.nama_prodi
        FROM transaksi t
        JOIN mahasiswa m ON t.nim = m.nim
        JOIN prodi p ON m.nama_prodi = p.nama_prodi
        WHERE t.peminjaman_id = ?
            AND t.status_peminjaman = 'accepted'
        `;
      }

      const [transactionData] = await connection.execute(transactionQuery, [
        transactionId,
      ]);

      if (transactionData.length === 0) {
        throw new Error(
          "Transaksi tidak ditemukan atau belum dalam status yang tepat"
        );
      }

      const transaction = transactionData[0];

      // Tambahkan pengecekan untuk menghindari error jika notes_checkout undefined
      if (!transaction.notes_checkout) {
        console.error(
          "Error: notes_checkout is undefined for transaction:",
          transaction
        );
        throw new Error(
          "Data transaksi tidak lengkap - notes_checkout tidak ditemukan"
        );
      }

      const metadata = JSON.parse(transaction.notes_checkout);

      const [itemCheck] = await connection.execute(
        'SELECT status FROM inventory WHERE id_barang = ? AND status = "tersedia"',
        [itemId]
      );

      if (itemCheck.length === 0) {
        throw new Error("Item tidak tersedia");
      }

      await connection.execute(
        `UPDATE transaksi
        SET id_barang = ?,
        admin_id_checkout = ?,
        waktu_checkout = NOW(),
        waktu_pengembalian_dijanjikan = ?,
        status_peminjaman = 'dipinjam',
        notes_checkout = ?
        WHERE peminjaman_id = ?
        `,
        [
          itemId,
          adminId,
          mysqlDateTime,
          JSON.stringify({
            ...metadata,
            completed_at: new Date().toISOString(),
            approved_by_admin: adminId,
            barcode_scanned_at: new Date().toISOString(),
          }),
          transactionId,
        ]
      );

      await connection.execute(
        'UPDATE inventory SET status = "dipinjam" WHERE id_barang = ?',
        [itemId]
      );

      await connection.commit();

      let completeDataQuery;
      const completeMetadataCheck = await connection.execute(
        "SELECT notes_checkout FROM transaksi WHERE peminjaman_id = ?",
        [transactionId]
      );

      if (completeMetadataCheck.length > 0) {
        // Tambahkan pengecekan untuk menghindari error jika notes_checkout undefined
        if (!completeMetadataCheck[0][0].notes_checkout) {
          console.error(
            "Error: notes_checkout is undefined for transaction:",
            completeMetadataCheck[0][0]
          );
          throw new Error(
            "Data transaksi tidak lengkap - notes_checkout tidak ditemukan"
          );
        }

        const metadata = JSON.parse(completeMetadataCheck[0][0].notes_checkout);
        if (metadata.borrower_type === "lecturer") {
          completeDataQuery = `SELECT 
            t.peminjaman_id,
            t.nip,
            d.nama_dosen as nama_peminjam,
            i.tipe_nama_barang,
            i.brand,
            i.model,
            i.barcode,
            t.waktu_checkout,
            t.waktu_pengembalian_dijanjikan,
            t.notes_checkout
          FROM transaksi t
          JOIN dosen d ON t.nip = d.nip
          JOIN inventory i ON t.id_barang = i.id_barang
          WHERE t.peminjaman_id = ?`;
        } else {
          completeDataQuery = `SELECT 
            t.peminjaman_id,
            t.nim,
            m.nama_mahasiswa as nama_peminjam,
            i.tipe_nama_barang,
            i.brand,
            i.model,
            i.barcode,
            t.waktu_checkout,
            t.waktu_pengembalian_dijanjikan,
            t.notes_checkout
          FROM transaksi t
          JOIN mahasiswa m ON t.nim = m.nim
          JOIN inventory i ON t.id_barang = i.id_barang
          WHERE t.peminjaman_id = ?`;
        }
      } else {
        completeDataQuery = `SELECT 
            t.peminjaman_id,
            t.nim,
            m.nama_mahasiswa as nama_peminjam,
            i.tipe_nama_barang,
            i.brand,
            i.model,
            i.barcode,
            t.waktu_checkout,
            t.waktu_pengembalian_dijanjikan,
            t.notes_checkout
          FROM transaksi t
          JOIN mahasiswa m ON t.nim = m.nim
          JOIN inventory i ON t.id_barang = i.id_barang
          WHERE t.peminjaman_id = ?`;
      }

      const [completeData] = await connection.execute(completeDataQuery, [
        transactionId,
      ]);

      const completeTransactionData = completeData[0];

      // Tambahkan pengecekan untuk menghindari error jika notes_checkout undefined
      if (!completeTransactionData.notes_checkout) {
        console.error(
          "Error: notes_checkout is undefined for transaction:",
          completeTransactionData
        );
        throw new Error(
          "Data transaksi tidak lengkap - notes_checkout tidak ditemukan"
        );
      }

      const transactionMetadata = JSON.parse(
        completeTransactionData.notes_checkout
      );

      const borrowerTypeMessage =
        transactionMetadata.borrower_type === "lecturer"
          ? "dosen"
          : "mahasiswa";
      const borrowerIdentifier =
        completeTransactionData.nim || completeTransactionData.nip;
      emitToStudent(borrowerIdentifier, "borrow_completed", {
        transaction: {
          ...completeTransactionData,
          lecturer_name: transactionMetadata.lecturer_name,
          class_name: transactionMetadata.class_name,
          borrower_type: transactionMetadata.borrower_type,
        },
        message: `Peminjaman berhasil diproses untuk ${borrowerTypeMessage}`,
      });

      emitToAdmins("request_processed", {
        transaction_id: transactionId,
        student_name: transaction.nama_peminjam,
        borrower_type: transactionMetadata.borrower_type,
        item_name: completeTransactionData.tipe_nama_barang,
      });

      return {
        transaction_id: transactionId,
        transaction_data: completeTransactionData,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async rejectBorrowRequest(transactionId, adminId, alasanPenolakan) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [transactionDetails] = await connection.execute(
        'SELECT nim, nip, notes_checkout FROM transaksi WHERE peminjaman_id = ? AND status_peminjaman IN ("pending","accepted")',
        [transactionId]
      );

      if (transactionDetails.length === 0) {
        throw new Error("Transaksi tidak ditemukan atau sudah diproses");
      }

      const transaction = transactionDetails[0];

      // Tambahkan pengecekan untuk menghindari error jika notes_checkout undefined
      if (!transaction.notes_checkout) {
        console.error(
          "Error: notes_checkout is undefined for transaction:",
          transaction
        );
        throw new Error(
          "Data transaksi tidak lengkap - notes_checkout tidak ditemukan"
        );
      }

      const metadata = JSON.parse(transaction.notes_checkout);

      await connection.execute(
        `
        UPDATE transaksi
        SET status_peminjaman = 'dikembalikan',
        admin_id_checkin = ?,
        waktu_pengembalian_sebenarnya = NOW(),
        notes_checkin = ?
        WHERE peminjaman_id = ?       
        `,
        [adminId, `Ditolak oleh admin: ${alasanPenolakan}`, transactionId]
      );

      await connection.commit();

      const borrowerTypeMessage =
        metadata.borrower_type === "lecturer" ? "dosen" : "mahasiswa";
      const borrowerIdentifier = transaction.nim || transaction.nip;

      emitToStudent(borrowerIdentifier, "borrow_rejected", {
        transaction_id: transactionId,
        alasan: alasanPenolakan,
        lecturer_name: metadata.lecturer_name,
        class_name: metadata.class_name,
        borrower_type: metadata.borrower_type,
        message: `Permintaan peminjaman ditolak untuk ${borrowerTypeMessage}`,
      });

      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getUserBorrowStatus(nim) {
    const [pendingTransactions] = await pool.execute(
      `
        SELECT 
            'pending' as status,
            peminjaman_id as id,
            notes_checkout,
            waktu_pengembalian_dijanjikan as expiry_time,
            created_at as timestamp,
            TIMESTAMPDIFF(SECOND, NOW(), waktu_pengembalian_dijanjikan) as seconds_remaining
        FROM transaksi
        WHERE nim = ? AND status_peminjaman = 'pending' AND waktu_pengembalian_dijanjikan > NOW()
        `,
      [nim]
    );

    const [acceptedTransactions] = await pool.execute(
      `
        SELECT
            'accepted' as status,
            peminjaman_id as id,
            notes_checkout,
            waktu_pengembalian_dijanjikan as expiry_time,
            created_at as timestamp,
            TIMESTAMPDIFF(SECOND, NOW(), waktu_pengembalian_dijanjikan) as seconds_remaining
        FROM transaksi
        WHERE nim = ? AND status_peminjaman = 'accepted' AND waktu_pengembalian_dijanjikan > NOW()
        `,
      [nim]
    );

    const [activeTransactions] = await pool.execute(
      `
        SELECT
            status_peminjaman as status,
            peminjaman_id as id,
            i.tipe_nama_barang,
            i.brand,
            i.model,
            waktu_checkout as timestamp,
            waktu_pengembalian_dijanjikan as return_due,
            notes_checkout
        FROM transaksi t
        LEFT JOIN inventory i ON t.id_barang = i.id_barang
        WHERE t.nim = ? AND t.status_peminjaman IN ('dipinjam','terlambat')
        `,
      [nim]
    );

    const results = [];

    [
      ...pendingTransactions,
      ...acceptedTransactions,
      ...activeTransactions,
    ].forEach((transaction) => {
      // Tambahkan pengecekan untuk menghindari error jika notes_checkout undefined
      let metadata = {};
      if (transaction.notes_checkout) {
        try {
          metadata = JSON.parse(transaction.notes_checkout);
        } catch (error) {
          console.error(
            "Error parsing notes_checkout:",
            error,
            "Transaction data:",
            transaction
          );
          metadata = {};
        }
      }

      results.push({
        ...transaction,
        lecturer_name: metadata.lecturer_name,
        class_name: metadata.class_name,
      });
    });

    return results.sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
  }

  static async getPendingRequests() {
    const query = `
    SELECT 
        t.peminjaman_id,
        t.nim,
        t.nip,
        t.id_barang,
  COALESCE(m.nama_mahasiswa, d.nama_dosen) as nama_peminjam,
        p.nama_prodi,
        t.notes_checkout,
        t.created_at,
        t.status_peminjaman,
        i.tipe_nama_barang as item_name,
        i.brand as item_brand,
        i.model as item_model,
        i.barcode as item_barcode
    FROM transaksi t
   LEFT JOIN mahasiswa m ON t.nim = m.nim
   LEFT JOIN dosen d ON t.nip = d.nip
   JOIN prodi p ON (m.nama_prodi = p.nama_prodi OR t.nama_prodi = p.nama_prodi)
   LEFT JOIN inventory i ON t.id_barang = i.id_barang
    WHERE t.status_peminjaman IN ('pending','accepted')
    ORDER BY t.created_at ASC
    `;

    const [rows] = await pool.execute(query);

    return rows
      .map((row) => {
        // Tambahkan pengecekan untuk menghindari error jika notes_checkout undefined
        let metadata = {};
        if (row.notes_checkout) {
          try {
            metadata = JSON.parse(row.notes_checkout);
          } catch (error) {
            console.error(
              "Error parsing notes_checkout:",
              error,
              "Row data:",
              row
            );
            metadata = {};
          }
        }

        const countDownExpiry = new Date(metadata.countdown_expiry);
        const now = new Date();
        const seconds_remaining = Math.max(
          0,
          Math.floor((countDownExpiry - now) / 1000)
        );

        return {
          ...row,
          lecturer_name: metadata.lecturer_name,
          class_name: metadata.class_name,
          seconds_remaining: seconds_remaining,
          expires_at: metadata.countDownExpiry,
          student_arrived: !!metadata.student_arrived_at,
        };
      })
      .filter((row) => row.seconds_remaining > 0);
  }

  static async directAdminLending(requestData) {
    const {
      nama_mahasiswa,
      nim_mahasiswa,
      nama_dosen,
      nip_dosen,
      kelas,
      nama_prodi,
      jadwal_id,
      waktu_pengembalian_dijanjikan,
      id_barang,
      admin_id,
    } = requestData;

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 2. Handle borrower (student or lecturer)
      let borrowerNim, borrowerNip, borrowerName, borrowerType;

      if (nama_mahasiswa && nim_mahasiswa) {
        // Student lending
        borrowerType = "student";
        borrowerNim = nim_mahasiswa;
        borrowerNip = null;
        borrowerName = nama_mahasiswa;

        const [existingStudent] = await connection.execute(
          "SELECT nim FROM mahasiswa WHERE nim = ?",
          [nim_mahasiswa]
        );

        if (existingStudent.length === 0) {
          await connection.execute(
            "INSERT INTO mahasiswa (nim, nama_mahasiswa, nama_prodi) VALUES (?, ?, ?)",
            [nim_mahasiswa, nama_mahasiswa, nama_prodi]
          );
        } else {
          // Update student info if needed
          await connection.execute(
            "UPDATE mahasiswa SET nama_mahasiswa = ?, nama_prodi = ? WHERE nim = ?",
            [nama_mahasiswa, nama_prodi, nim_mahasiswa]
          );
        }
      } else if (nama_dosen && nip_dosen) {
        // Lecturer lending - use proper NIP column
        borrowerType = "lecturer";
        borrowerNim = null;
        borrowerNip = nip_dosen;
        borrowerName = nama_dosen;

        // Verify lecturer exists in dosen table
        const [existingLecturer] = await connection.execute(
          "SELECT nip FROM dosen WHERE nip = ?",
          [nip_dosen]
        );

        if (existingLecturer.length === 0) {
          throw new Error(
            `Dosen dengan NIP ${nip_dosen} tidak ditemukan dalam database`
          );
        }
      } else {
        throw new Error(
          "Informasi peminjam tidak lengkap. Harus ada mahasiswa (nama dan NIM) atau dosen (nama dan NIP)"
        );
      }

      // 3. Find or create lecturer
      let lecturerNIP;
      if (nama_dosen) {
        const [existingLecturer] = await connection.execute(
          "SELECT nip FROM dosen WHERE nama_dosen = ?",
          [nama_dosen]
        );

        lecturerNIP = existingLecturer[0].nip;
      } else {
        lecturerNIP = null;
      }

      // 4. Find or create class
      let classId;
      const [existingClass] = await connection.execute(
        "SELECT id_kelas FROM kelas WHERE nama_kelas = ?",
        [kelas]
      );

      classId = existingClass[0].id_kelas;

      // 5. Check if item is available
      const [itemCheck] = await connection.execute(
        'SELECT status FROM inventory WHERE id_barang = ? AND status = "tersedia"',
        [id_barang]
      );

      if (itemCheck.length === 0) {
        throw new Error("Item tidak tersedia");
      }

      // 6. Create direct lending transaction - immediately completed
      const returnDateTime = new Date(waktu_pengembalian_dijanjikan);
      const mysqlDateTime = returnDateTime
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

      const requestMetadata = {
        borrower_type: borrowerType,
        lecturer_nip: lecturerNIP,
        lecturer_name: nama_dosen || null,
        original_nim: borrowerType === "lecturer" ? nip_dosen : nim_mahasiswa,
        original_name: borrowerName,
        class_name: kelas,
        class_id: classId,
        direct_admin_lending: true,
        admin_lending_date: new Date().toISOString(),
        lending_admin: admin_id,
      };

      // Insert directly as completed transaction
      const [transactionResult] = await connection.execute(
        `INSERT INTO transaksi
          (nim, nip, jadwal_id, id_barang, waktu_checkout, waktu_pengembalian_dijanjikan, status_peminjaman, admin_id_checkout, notes_checkout, nama_prodi)
          VALUES (?, ?, ?, ?, NOW(), ?, 'dipinjam', ?, ?, ?)`,
        [
          borrowerNim,
          borrowerNip,
          jadwal_id,
          id_barang,
          mysqlDateTime,
          admin_id,
          JSON.stringify(requestMetadata),
          nama_prodi,
        ]
      );

      const transactionId = transactionResult.insertId;

      // Update inventory status
      await connection.execute(
        'UPDATE inventory SET status = "dipinjam" WHERE id_barang = ?',
        [id_barang]
      );

      await connection.commit();

      // Get complete transaction data - support both student and lecturer
      let completeDataQuery;
      if (borrowerType === "lecturer") {
        completeDataQuery = `SELECT
          t.peminjaman_id,
          t.nip,
          d.nama_dosen as nama_peminjam,
          i.tipe_nama_barang,
          i.brand,
          i.model,
          i.barcode,
          t.waktu_checkout,
          t.waktu_pengembalian_dijanjikan,
          t.notes_checkout
        FROM transaksi t
        JOIN dosen d ON t.nip = d.nip
        JOIN inventory i ON t.id_barang = i.id_barang
        WHERE t.peminjaman_id = ?`;
      } else {
        completeDataQuery = `SELECT
          t.peminjaman_id,
          t.nim,
          m.nama_mahasiswa as nama_peminjam,
          i.tipe_nama_barang,
          i.brand,
          i.model,
          i.barcode,
          t.waktu_checkout,
          t.waktu_pengembalian_dijanjikan,
          t.notes_checkout
        FROM transaksi t
        JOIN mahasiswa m ON t.nim = m.nim
        JOIN inventory i ON t.id_barang = i.id_barang
        WHERE t.peminjaman_id = ?`;
      }

      const [completeData] = await connection.execute(completeDataQuery, [
        transactionId,
      ]);

      const completeTransactionData = completeData[0];
      const transactionMetadata = JSON.parse(
        completeTransactionData.notes_checkout
      );

      // Emit success to borrower
      const borrowerIdentifier =
        borrowerType === "lecturer" ? borrowerNip : borrowerNim;
      emitToStudent(borrowerIdentifier, "direct_lending_completed", {
        transaction: {
          ...completeTransactionData,
          lecturer_name: transactionMetadata.lecturer_name,
          class_name: transactionMetadata.class_name,
          borrower_type: transactionMetadata.borrower_type,
        },
        message: `Peminjaman langsung oleh admin berhasil untuk ${
          borrowerType === "lecturer" ? "dosen" : "mahasiswa"
        }`,
      });

      // Emit to admins
      emitToAdmins("direct_lending_completed", {
        transaction_id: transactionId,
        borrower_name: borrowerName,
        borrower_type: borrowerType,
        item_name: completeTransactionData.tipe_nama_barang,
        lending_admin: admin_id,
      });

      return {
        transaction_id: transactionId,
        transaction_data: completeTransactionData,
        message: "Direct lending completed successfully",
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export default BorrowService;
