import pool from "../data/db_setting.js";
import { emitToAdmins, emitToStudent } from "../services/socketService.js";

export async function validateBorrowEligibility(
  nim_mahasiswa,
  jadwal_id,
  returnDate
) {
  const connection = await pool.getConnection();

  try {
    const [studentData] = await connection.execute(
      "SELECT nama_prodi FROM mahasiswa WHERE nim = ?",
      [nim_mahasiswa]
    );

    if (studentData.length === 0) {
      throw new Error("Mahasiswa tidak ditemukan");
    }

    const nama_prodi = studentData[0].nama_prodi;

    const [scheduleData] = await connection.execute(
      `
            SELECT 
                j.id_jadwal,
                j.nama_prodi,
                j.hari_dalam_seminggu,
                j.waktu_mulai,
                j.waktu_berakhir,
                k.nama_kelas,
                d.nama_dosen,
                r.nomor_ruangan
            FROM jadwal j
            JOIN kelas k ON j.id_kelas = k.id_kelas
            JOIN dosen d ON j.nip = d.nip
            JOIN ruangan r ON j.id_ruangan = r.id_ruangan
            WHERE j.id_jadwal = ?
            `,
      [jadwal_id]
    );
    if (scheduleData.length === 0) {
      throw new Error("Jadwal yang dipilih tidak ditemukan");
    }
    const schedule = scheduleData[0];

    if (schedule.nama_prodi !== nama_prodi) {
      throw new Error(
        `Jadwal ini untuk program studi ${schedule.nama_prodi}, bukan untuk ${nama_prodi}`
      );
    }

    const returnDateTime = new Date(returnDate);
    const now = new Date();

    if (returnDateTime <= now) {
      throw new Error("Waktu pengembalian harus di waktu selanjutnya");
    }

    return {
      valid: true,
      schedule: schedule,
    };
  } catch (error) {
    console.log(error);
  } finally {
    connection.release();
  }
}

export async function autoRejectAllExpiredRequests() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Find all expired pending transactions
    const [expiredTransactions] = await connection.execute(`
      SELECT t.peminjaman_id, t.nim, t.notes_checkout, m.nama_mahasiswa
      FROM transaksi t
      JOIN mahasiswa m ON t.nim = m.nim
      WHERE t.status_peminjaman = 'pending'
        AND t.waktu_pengembalian_dijanjikan <= NOW()
    `);

    if (expiredTransactions.length === 0) {
      return { rejected_count: 0 };
    }

    // Update all expired transactions
    const transactionIds = expiredTransactions.map((t) => t.peminjaman_id);
    await connection.execute(
      `
      UPDATE transaksi
      SET status_peminjaman = 'dikembalikan',
          notes_checkin = 'Otomatis ditolak: Tidak datang dalam waktu 15 menit',
          waktu_pengembalian_sebenarnya = NOW()
      WHERE peminjaman_id IN (${transactionIds.map(() => "?").join(",")})
    `,
      transactionIds
    );

    await connection.commit();

    // Notify students and admins
    expiredTransactions.forEach((transaction) => {
      const metadata = JSON.parse(transaction.notes_checkout);
      emitToStudent(transaction.nim, "borrow_auto_rejected", {
        transaction_id: transaction.peminjaman_id,
        reason: "Tidak datang ke admin dalam waktu 15 menit",
        lecturer_name: metadata.lecturer_name,
        class_name: metadata.class_name,
      });
    });

    emitToAdmins("bulk_requests_auto_rejected", {
      count: expiredTransactions.length,
      requests: expiredTransactions,
    });

    return {
      rejected_count: expiredTransactions.length,
      rejected_requests: expiredTransactions,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Auto-update overdue items to "belum dikembalikan" status
export async function updateOverdueItems() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Find items that are past due date and still marked as "dipinjam"
    const [overdueItems] = await connection.execute(
      `
      SELECT
        t.peminjaman_id,
        t.nim,
        m.nama_mahasiswa,
        i.barcode,
        i.tipe_nama_barang,
        t.waktu_pengembalian_dijanjikan,
        TIMESTAMPDIFF(DAY, t.waktu_pengembalian_dijanjikan, NOW()) as days_overdue
      FROM transaksi t
      JOIN mahasiswa m ON t.nim = m.nim
      JOIN inventory i ON t.id_barang = i.id_barang
      WHERE t.status_peminjaman = 'dipinjam'
        AND t.waktu_pengembalian_dijanjikan < NOW()
    `
    );

    if (overdueItems.length === 0) {
      return { updated_count: 0 };
    }

    // Update status to "terlambat" (which indicates overdue)
    const transactionIds = overdueItems.map((item) => item.peminjaman_id);
    await connection.execute(
      `
      UPDATE transaksi
      SET status_peminjaman = 'terlambat',
          notes_checkin = CONCAT(COALESCE(notes_checkin, ''), ' | Status otomatis: Belum dikembalikan (terlambat)')
      WHERE peminjaman_id IN (${transactionIds.map(() => "?").join(",")})
    `,
      transactionIds
    );

    await connection.commit();

    // Notify students about overdue status
    overdueItems.forEach((item) => {
      emitToStudent(item.nim, "item_overdue", {
        transaction_id: item.peminjaman_id,
        item_name: item.tipe_nama_barang,
        days_overdue: item.days_overdue,
        due_date: item.waktu_pengembalian_dijanjikan,
      });
    });

    // Notify admins about overdue items
    emitToAdmins("items_overdue", {
      count: overdueItems.length,
      overdue_items: overdueItems,
    });

    return {
      updated_count: overdueItems.length,
      overdue_items: overdueItems,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function autoRejectExpiredRequest(transactionId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Check if transaction is still pending and expired
    const [transactionData] = await connection.execute(
      `
      SELECT t.nim, t.notes_checkout, m.nama_mahasiswa
      FROM transaksi t
      JOIN mahasiswa m ON t.nim = m.nim
      WHERE t.peminjaman_id = ?
        AND t.status_peminjaman = 'pending'
        AND t.waktu_pengembalian_dijanjikan <= NOW()
    `,
      [transactionId]
    );

    if (transactionData.length === 0) {
      return false; // Transaction not found or already processed
    }

    const transaction = transactionData[0];
    const metadata = JSON.parse(transaction.notes_checkout);

    // Update transaction status to rejected
    await connection.execute(
      `
      UPDATE transaksi
      SET status_peminjaman = 'dikembalikan',
          notes_checkin = 'Otomatis ditolak: Tidak datang dalam waktu 15 menit',
          waktu_pengembalian_sebenarnya = NOW()
      WHERE peminjaman_id = ?
    `,
      [transactionId]
    );

    await connection.commit();

    // Notify student about auto-rejection
    emitToStudent(transaction.nim, "borrow_auto_rejected", {
      transaction_id: transactionId,
      reason: "Tidak datang ke admin dalam waktu 15 menit",
      lecturer_name: metadata.lecturer_name,
      class_name: metadata.class_name,
    });

    // Notify admins
    emitToAdmins("request_auto_rejected", {
      transaction_id: transactionId,
      student_name: transaction.nama_mahasiswa,
      reason: "15 minute timeout",
    });

    return true;
  } catch (error) {
    await connection.rollback();
    console.error("Error auto-rejecting expired request:", error);
    return false;
  } finally {
    connection.release();
  }
}
