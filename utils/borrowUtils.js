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

export async function autoRejectExpiredRequest(transactionId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [transactionData] = await connection.execute(
      `
            SELECT t.nim, t.notes_checkout, m.nama_mahasiswa
            FROM transaksi t
            JOIN mahasiswa m ON t.nim = m.nim
            WHERE t.peminjaman_id = ?
                AND t.sattus_peminjaman = 'pending'
                AND t.waktu_pengembalian_dijanjikan <= NOW()
            `,
      [transactionId]
    );

    if (transactionData.length === 0) {
      return false;
    }

    const transaction = transactionData[0];
    const metadata = JSON.parse(transaction.notes_checkout);

    await connection.execute(
      `
        UPDATE transaksi
        SET status_peminjaman = 'dikembalikan',
            notes_checkin = 'Otomatis ditolak: tidak datang dalam 15 menit',
            waktu_pengembalian_sebenarnya = NOW()
        WHERE peminjaman_id = ?
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
