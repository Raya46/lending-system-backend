import pool from "../data/db_postgres.js";

import { emitToAdmins, emitToStudent } from "../services/socketService.js";

export async function validateBorrowEligibility(
  nim_mahasiswa,
  jadwal_id,
  returnDate
) {
  const connection = await pool.connect();

  try {
    const studentData = await connection.query(
      "SELECT nama_prodi FROM mahasiswa WHERE nim = $1",
      [nim_mahasiswa]
    );

    if (studentData.rows.length === 0) {
      throw new Error("Mahasiswa tidak ditemukan");
    }

    const nama_prodi = studentData.rows[0].nama_prodi;

    const scheduleData = await connection.query(
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
            WHERE j.id_jadwal = $1
            `,
      [jadwal_id]
    );
    if (scheduleData.rows.length === 0) {
      throw new Error("Jadwal yang dipilih tidak ditemukan");
    }
    const schedule = scheduleData.rows[0];

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
    throw error;
  } finally {
    connection.release();
  }
}

export async function autoRejectExpiredRequest(transactionId) {
  const connection = await pool.connect();

  try {
    await connection.beginTransaction();

    const transactionData = await connection.query(
      `
            SELECT t.nim, t.notes_checkout, m.nama_mahasiswa
            FROM transaksi t
            JOIN mahasiswa m ON t.nim = m.nim
            WHERE t.peminjaman_id = $1
                AND t.status_peminjaman = 'pending'
                AND t.waktu_pengembalian_dijanjikan <= NOW()
            `,
      [transactionId]
    );

    if (transactionData.rows.length === 0) {
      return false;
    }

    const transaction = transactionData.rows[0];
    const metadata = JSON.parse(transaction.notes_checkout);

    await connection.query(
      `
        UPDATE transaksi
        SET status_peminjaman = 'dikembalikan',
            notes_checkin = 'Otomatis ditolak: tidak datang dalam 15 menit',
            waktu_pengembalian_sebenarnya = NOW()
        WHERE peminjaman_id = $1
        `,
      [transactionId]
    );

    await connection.commit();

    emitToStudent(transaction.nim, "borrow_auto_rejected", {
      transaction_id: transactionId,
      reason: "Tidak datang ke admin dalam 15 menit",
      lecturer_name: metadata.lecturer_name,
      class_name: metadata.class_name,
    });

    emitToAdmins("request_auto_rejected", {
      transaction_id: transactionId,
      student_name: transaction.nama_mahasiswa,
      reason: "15 menit habis",
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
