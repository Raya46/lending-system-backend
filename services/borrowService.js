import pool from "../data/db_setting.js";
import {
  autoRejectExpiredRequest,
  validateBorrowEligibility,
} from "../utils/borrowUtils.js";
import { emitToAdmins, emitToStudent } from "./socketService.js";

class BorrowService {
  static async submitBorrowRequest(requestData) {
    const {
      nama_mahasiswa,
      nim_mahasiswa,
      nama_dosen,
      kelas,
      nama_prodi,
      jadwal_id,
      waktu_pengembalian_dijanjikan,
      id_barang,
    } = requestData;

    await validateBorrowEligibility(
      nim_mahasiswa,
      jadwal_id,
      waktu_pengembalian_dijanjikan
    );

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [existingStudent] = await connection.execute(
        "SELECT nim FROM mahasiswa WHERE nim = ?",
        [nim_mahasiswa]
      );

      if (existingStudent.length === 0) {
        await connection.execute(
          "INSERT INTO mahasiswa (nim, nama_mahasiswa, nama_prodi) VALUES (?,?,?)",
          [nim_mahasiswa, nama_mahasiswa, nama_prodi]
        );
      }

      const [existingLecturer] = await connection.execute(
        "SELECT nip FROM dosen WHERE nama_dosen = ?",
        [nama_dosen]
      );

      const lecturerNIP = existingLecturer[0].nip;

      const [existingClass] = await connection.execute(
        "SELECT id_kelas FROM kelas WHERE nama_kelas = ?",
        [kelas]
      );

      const classId = existingClass[0].id_kelas;

      const [pendingCheck] = await connection.execute(
        `SELECT peminjaman_id FROM transaksi
        WHERE nim = ? AND status_peminjaman IN ('pending','accepted')
        AND waktu_pengembalian_dijanjikan > NOW()
        `,
        [nim_mahasiswa]
      );

      if (pendingCheck.length > 0) {
        throw new Error(
          "Anda masih memiliki permintaan pending yang belum selesai"
        );
      }

      const returnDateTime = new Date(waktu_pengembalian_dijanjikan);
      const countDownExpiry = new Date();
      countDownExpiry.setMinutes(countDownExpiry.getMinutes() + 15);

      const requestMetadata = {
        lecturer_nip: lecturerNIP,
        lecturer_name: nama_dosen,
        class_name: kelas,
        countdown_expiry: countDownExpiry.toISOString(),
        actual_return_date: returnDateTime.toISOString(),
        request_type: "borrow_request",
        validation_passed: true,
      };

      const [transactionResult] = await connection.execute(
        `INSERT INTO transaksi
            (nim,jadwal_id, id_barang, waktu_pengembalian_dijanjikan, status_peminjaman, notes_checkout, nama_prodi)
            VALUES (?,?,?,?,'pending',?,?)`,
        [
          nim_mahasiswa,
          jadwal_id,
          id_barang,
          returnDateTime.toISOString().slice(0, 19).replace("T", " "),
          JSON.stringify(requestMetadata),
          nama_prodi,
        ]
      );

      const transactionId = transactionResult.insertId;
      await connection.commit();

      const [requestDataResult] = await connection.execute(
        `SELECT
            t.peminjaman_id,
            t.nim,
            m.nama_mahasiswa,
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
        WHERE t.peminjaman_id = ?    
        `,
        [transactionId]
      );

      const metadata = JSON.parse(requestDataResult[0].notes_checkout);
      const completeRequestData = {
        ...requestDataResult[0],
        lecturer_name: metadata.lecturer_name,
        class_name: metadata.class_name,
        expiry_time: requestDataResult[0].expires_at,
      };

      emitToAdmins("new_borrow_request", {
        ...completeRequestData,
        countdown_minutes: 15,
        request_type: "borrow_request",
        status: "awaiting_acceptance",
      });

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

      const [transactionData] = await connection.execute(
        `SELECT t.*, m.nama_mahasiswa
            FROM transaksi t
            JOIN mahasiswa m ON t.nim = m.nim
            WHERE t.peminjaman_id = ? AND t.status_peminjaman = 'pending'`,
        [transactionId]
      );

      if (transactionData.length === 0) {
        throw new Error("Transaksi tidak ditemukan atau sudah diproses");
      }

      const transaction = transactionData[0];
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
            status: "ready_for_barcode_scane",
          }),
          transactionId,
        ]
      );

      await connection.commit();

      emitToStudent(transaction.nim, "borrow_accepted", {
        transaction_id: transactionId,
        message:
          "Permintaan peminjaman Anda telah diterima! Admin akan memproses peminjaman.",
        lecturer_name: metadata.lecturer_name,
        class_name: metadata.class_name,
        admin_id: adminId,
      });

      emitToAdmins("student_arrived", {
        transaction_id: transactionId,
        student_name: transaction.nama_mahasiswa,
        student_nim: transaction.nim,
        message:
          "Mahasiswa sudah tiba di meja admin. Silahkan scan barcode barang",
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

      const [transactionData] = await connection.execute(
        `SELECT t.*, m.nama_mahasiswa, p.nama_prodi
        FROM transaksi t
        JOIN mahasiswa m ON t.nim = m.nim
        JOIN prodi p ON m.nama_prodi = p.nama_prodi
        WHERE t.peminjaman_id = ?
            AND t.status_peminjaman = 'accepted'
        `,
        [transactionId]
      );

      if (transactionData.length === 0) {
        throw new Error(
          "Transaksi tidak ditemukan atau belum dalam status yang tepat"
        );
      }

      const transaction = transactionData[0];
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

      const [completeData] = await connection.execute(
        `SELECT 
            t.*,
            m.nama_mahasiswa,
            i.tipe_nama_barang,
            i.brand,
            i.model,
            i.barcode
            FROM transaksi t
            JOIN mahasiswa m ON t.nim = m.nim
            JOIN inventory i ON t.id_barang = i.id_barang
            WHERE t.peminjaman_id = ?`,
        [transactionId]
      );

      const completeTransactionData = completeData[0];
      const transactionMetadata = JSON.parse(
        completeTransactionData.notes_checkout
      );

      emitToStudent(transaction.nim, "borrow_completed", {
        transaction: {
          ...completeTransactionData,
          lecturer_name: transactionMetadata.lecturer_name,
          class_name: transactionMetadata.class_name,
        },
        message: "Peminjaman berhasil diproses",
      });

      emitToAdmins("request_processed", {
        transaction_id: transactionId,
        student_name: transaction.nama_mahasiswa,
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
        'SELECT nim, notes_checkout FROM transaksi WHERE peminjaman_id = ? AND status_peminjaman IN ("pending","accepted")',
        [transactionId]
      );

      if (transactionDetails.length === 0) {
        throw new Error("Transaksi tidak ditemukan atau sudah diproses");
      }

      const transaction = transactionDetails[0];
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
        [adminId, `Ditolaj oleh admin: ${alasanPenolakan}`, transactionId]
      );

      await connection.commit();

      emitToStudent(transaction.nim, "borrow_rejected", {
        transaction_id: transactionId,
        alasan: alasanPenolakan,
        lecturer_name: metadata.lecturer_name,
        class_name: metadata.class_name,
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
        WHERE t.nim = ? AND t.status_peminjaman ('dipinjam','terlambat')
        `,
      [nim]
    );

    const results = [];

    [
      ...pendingTransactions,
      ...acceptedTransactions,
      ...acceptedTransactions,
    ].forEach((transaction) => {
      const metadata = JSON.parse(transaction.notes_checkout || "{}");
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
        m.nama_mahasiswa,
        p.nama_prodi,
        t.notes_checkout,
        t.created_at,
        t.status_peminjaman
    FROM transaksi t
    JOIN mahasiswa m ON t.nim = m.nim
    JOIN prodi p ON m.nama_prodi = p.nama_prodi
    WHERE t.status_peminjaman IN ('pending','accepted')
    ORDER BY t.created_at ASC
    `;

    const [rows] = await pool.execute(query);

    return rows
      .map((row) => {
        const metadata = JSON.parse(row.notes_checkout || "{}");
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

      const [existingStudent] = await connection.execute(
        "SELECT nim FROM mahasiswa WHERE nim = ?",
        [nim_mahasiswa]
      );

      if (existingStudent.length === 0) {
        await connection.execute(
          "INSERT INTO mahasiswa (nim, nama_mahasiswa, nama_prodi) VALUES (?,?,?)",
          [nim_mahasiswa, nama_mahasiswa, nama_prodi]
        );
      }

      const [existingLecturer] = await connection.execute(
        "SELECT nip FROM dosen WHERE nama_dosen = ?",
        [nama_dosen]
      );

      const lecturerNIP = existingLecturer[0].nip;

      const [existingClass] = await connection.execute(
        "SELECT id_kelas FROM kelas WHERE nama_kelas = ?",
        [kelas]
      );

      const classId = existingClass[0].id_kelas;

      const [itemCheck] = await connection.execute(
        'SELECT status FROM inventory WHERE id_barang = ? AND status = "tersedia"',
        [id_barang]
      );
      if (itemCheck.length === 0) {
        throw new Error("Item tidak tersedia");
      }

      const returnDateTime = new Date(waktu_pengembalian_dijanjikan);
      const mysqlDateTime = returnDateTime
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

      const requestMetadata = {
        lecturer_nip: lecturerNIP,
        lecturer_name: nama_dosen,
        class_name: kelas,
        class_id: classId,
        direct_admin_lending: true,
        admin_lending_date: new Date().toISOString(),
        lending_admin: admin_id,
      };

      const [transactionResult] = await connection.execute(
        `INSERT INTO transaksi
            (nim,jadwal_id, id_barang, waktu_checkout, waktu_pengembalian_dijanjikan, status_peminjaman, admin_id_checkout,notes_checkout, nama_prodi)
            VALUES (?,?,?,NOW(),?,'dipinjam',?,?,?)`,
        [
          nim_mahasiswa,
          jadwal_id,
          id_barang,
          mysqlDateTime,
          admin_id,
          JSON.stringify(requestMetadata),
          nama_prodi,
        ]
      );

      const transactionId = transactionResult.insertId;
      await connection.execute(
        'UPDATE inventory SET status = "dipinjam" WHERE id_barang = ?',
        [id_barang]
      );
      await connection.commit();

      const [completeData] = await connection.execute(
        `SELECT
            t.peminjaman_id,
            t.nim,
            m.nama_mahasiswa,
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
        WHERE t.peminjaman_id = ?    
        `,
        [transactionId]
      );

      const completeTransactionData = completeData[0];
      const transactionMetadata = JSON.parse(
        completeTransactionData.notes_checkout
      );

      emitToStudent(nim_mahasiswa, "direct_lending_completed", {
        transaction: {
          ...completeTransactionData,
          lecturer_name: transactionMetadata.lecturer_name,
          class_name: transactionMetadata.class_name,
        },
      });

      emitToAdmins("direct_lending_completed", {
        transaction_id: transactionId,
        student_name: nama_mahasiswa,
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
