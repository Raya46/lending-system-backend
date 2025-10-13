import pool from "../data/db_postgres.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import xlsx from "xlsx";
import {
  detectFileType,
  parsePerColumn,
  parsePerSheet,
} from "../utils/excelParser.mjs";
class AdminService {
  static async extractAcademicYear(nim) {
    if (!nim || nim.length < 2) return null;
    const yearPrefix = nim.substring(0, 2);
    const currentYear = new Date().getFullYear();
    const currentCentury = Math.floor(currentYear / 100) * 100;

    // convert 2-digit year to 4-digit year
    let academicYear = currentCentury + parseInt(yearPrefix);

    if (academicYear > currentYear) {
      academicYear -= 100;
    }
    return `${academicYear}/${academicYear + 1}`;
  }
  // function untuk login admin
  static async login(username, password) {
    const result = await pool.query(
      "SELECT * FROM admin_users WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      throw new Error("Username tidak ditemukan");
    }
    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw new Error("Password Salah");
    }
    const token = jwt.sign(
      {
        admin_id: user.admin_id,
        username: user.username,
        role: user.role,
      },
      process.env.JWT_SECRET || "rahasia",
      { expiresIn: "24h" }
    );

    return {
      token,
      admin: {
        admin_id: user.admin_id,
        username: user.username,
        nama_lengkap: user.nama_lengkap,
        role: user.role,
      },
    };
  }

  static async getTopLendingItems() {
    const query = `
    SELECT 
      i.tipe_nama_barang as name,
      COUNT(t.peminjaman_id) as lent_quantity,
      i.id_barang
    FROM transaksi t
    JOIN inventory i ON t.id_barang = i.id_barang
    WHERE t.status_peminjaman IN ('dipinjam','dikembalikan')
    GROUP BY i.id_barang, i.tipe_nama_barang
    ORDER BY lent_quantity DESC 
    LIMIT 10
    `;

    const result = await pool.query(query);

    const itemsWithRemaining = await Promise.all(
      result.rows.map(async (item) => {
        const remainingResult = await pool.query(
          "SELECT COUNT(*) as remaining FROM inventory WHERE tipe_nama_barang = $1 AND status = $2",
          [item.name, "tersedia"]
        );
        return {
          name: item.name,
          lentQuantity: item.lent_quantity,
          remainingQuantity: remainingResult.rows[0].remaining || 0,
        };
      })
    );
    return itemsWithRemaining;
  }

  static async getLowStockItems() {
    const query = `
    SELECT 
      tipe_nama_barang as name,
      COUNT(*) as remaining_quantity,
      status
    FROM inventory
    WHERE status = 'tersedia'
    GROUP BY tipe_nama_barang, status
    HAVING remaining_quantity <= 15
    ORDER BY remaining_quantity ASC
    LIMIT 10
    `;

    const result = await pool.query(query);
    return result.rows.map((item) => ({
      name: item.name,
      remainingQuantity: item.remainingQuantity,
      status: item.remaining_quantity <= 5 ? "Critical" : "Low",
    }));
  }

  static async getInventorySummary() {
    const result = await pool.query(`
      SELECT
        COUNT(CASE WHEN status = 'tersedia' THEN 1 END) as quantity_in_hand,
        COUNT(CASE WHEN status IN ('dipinjam','diperbaiki') THEN 1 END) as to_be_received
      FROM inventory
      `);

    return {
      quantityInHand: result.rows[0].quantity_in_hand,
      toBeReceived: result.rows[0].to_be_received,
    };
  }

  static async getInventoryData(limit = 10, offset = 0) {
    const queryCount = `SELECT COUNT (tipe_nama_barang) as total FROM inventory`;
    const countResult = await pool.query(queryCount);
    const totalItems = countResult.rows[0].total;
    const query = `
    SELECT 
      i.tipe_nama_barang as item,
    COUNT(CASE WHEN t.status_peminjaman IN ('dipinjam','diperbaiki') THEN 1 END) as lent_quantity,
    COUNT(CASE WHEN i.status = 'tersedia' THEN 1 END) as remaining_quantity,
    COUNT(*) as total_quantity,
    MAX(i.tanggal_pembelian) as latest_purchase_date,
    CASE
        WHEN COUNT(CASE WHEN i.status = 'tersedia' THEN 1 END) = 0 THEN 'Out of Stock'
        WHEN COUNT(CASE WHEN i.status = 'tersedia' THEN 1 END) <= 15 THEN 'Low Stock'
        ELSE 'In-stock'
    END as availability
    FROM inventory i
    LEFT JOIN transaksi t ON i.id_barang = t.id_barang
    GROUP BY i.tipe_nama_barang
    ORDER BY i.tipe_nama_barang
    LIMIT $1 OFFSET $2
    `;

    const result = await pool.query(query, [limit, offset]);

    const data = result.rows.map((item) => ({
      ...item,
      lentQuantity: `${item.lent_quantity} Pieces`,
      remainingQuantity: `${item.remaining_quantity} Pieces`,
      totalQuantity: `${item.total_quantity} Pieces`,
      expiryDate: item.latest_purchase_date
        ? new Date(item.latest_purchase_date).toLocaleDateString("id-ID")
        : "N/A",
    }));
    return {
      data: data,
      total: totalItems,
    };
  }

  static async getClassOverview() {
    const queries = [
      "SELECT COUNT(*) as total_classes FROM prodi",
      "SELECT COUNT(*) as total_students FROM mahasiswa",
      "SELECT COUNT(*) as active_loans FROM transaksi WHERE status_peminjaman = $1",
      "SELECT COUNT(DISTINCT p.nama_prodi) as active_classes FROM prodi p JOIN mahasiswa m ON p.nama_prodi = m.nama_prodi JOIN transaksi t ON m.nim = t.nim WHERE t.status_peminjaman IN ($1)",
    ];

    const [result1, result2, result3, result4] = await Promise.all([
      pool.query(queries[0]),
      pool.query(queries[1], ["dipinjam"]),
      pool.query(queries[2], ["dipinjam"]),
      pool.query(queries[3], ["dipinjam"]),
    ]);

    return {
      total_classes: result1.rows[0].total_classes,
      total_students: result2.rows[0].total_students,
      active_loans: result3.rows[0].active_loans,
      active_classes: result4.rows[0].active_classes,
    };
  }

  static async getClassesTable(limit = 10, offset = 0) {
    const countQuery = `SELECT COUNT(*) as total FROM prodi`;
    const countResult = await pool.query(countQuery);
    const total = countResult.rows[0].total;
    const query = `
    SELECT
    p.nama_prodi as class_name,
    COUNT(DISTINCT m.nim) as total_students_per_kelas,
    COUNT(t.peminjaman_id) as active_loans_per_kelas,
    CASE
        WHEN COUNT(t.peminjaman_id) > 0 THEN 'active'
        ELSE 'inactive'
    END as status
    FROM prodi p
    LEFT JOIN mahasiswa m on p.nama_prodi = m.nama_prodi
    LEFT JOIN transaksi t ON m.nim = t.nim
        AND t.status_peminjaman = 'dipinjam'
    GROUP BY p.nama_prodi
    ORDER BY p.nama_prodi ASC
    LIMIT $1 OFFSET $2
    `;
    const result = await pool.query(query, [limit, offset]);
    return {
      data: result.rows,
      total: total,
    };
  }

  static async createMahasiswa(mahasiswaData) {
    const { nim, nama_mahasiswa, nama_prodi } = mahasiswaData;

    const existingResult = await pool.query(
      "SELECT nim FROM mahasiswa WHERE nim = $1",
      [nim]
    );

    if (existingResult.rows.length > 0) {
      throw new Error("NIM sudah terdaftar");
    }

    const prodiCheckResult = await pool.query(
      "SELECT nama_prodi FROM prodi WHERE nama_prodi = $1",
      [nama_prodi]
    );

    if (prodiCheckResult.rows.length === 0) {
      throw new Error("Program studi tidak ditemukan");
    }

    await pool.query(
      "INSERT INTO mahasiswa (nim,nama_mahasiswa,nama_prodi,mahasiswa_aktif) VALUES ($1,$2,$3,$4)",
      [nim, nama_mahasiswa, nama_prodi, true]
    );

    return {
      message: "Mahasiswa berhasil dibuat",
      data: { nim, nama_mahasiswa, nama_prodi },
    };
  }

  static async getMahasiswaByProgramStudy(nama_prodi, limit = 10, offset = 0) {
    const prodiCheckResult = await pool.query(
      "SELECT nama_prodi FROM prodi WHERE nama_prodi = $1",
      [nama_prodi]
    );

    if (prodiCheckResult.rows.length === 0) {
      throw new Error("Program studi tidak ditemukan");
    }

    const query = `
      SELECT
        m.nim,
        m.nama_mahasiswa,
        m.nama_prodi,
        m.mahasiswa_aktif,
        m.created_at,
        p.kepanjangan_prodi,
        COUNT(t.peminjaman_id) as total_peminjaman,
        COUNT(CASE WHEN t.status_peminjaman IN ('dipinjam','terlambat') THEN 1 END) as active_loans
      FROM mahasiswa m
      LEFT JOIN prodi p ON m.nama_prodi = p.nama_prodi
      LEFT JOIN transaksi t ON m.nim = t.nim
      WHERE m.nama_prodi = $1
      GROUP BY m.nim, m.nama_mahasiswa, m.mahasiswa_aktif, m.created_at, p.kepanjangan_prodi
      ORDER BY m.nama_mahasiswa ASC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [nama_prodi, limit, offset]);
    return {
      programStudi: prodiCheckResult.rows[0],
      mahasiswa: result.rows,
      total: result.rows.length,
    };
  }

  static async updateMahasiswa(nim, mahasiswaData) {
    const { nama_mahasiswa, nama_prodi, mahasiswa_aktif } = mahasiswaData;

    const existingResult = await pool.query(
      "SELECT nama_prodi FROM prodi WHERE nama_prodi = $1",
      [nama_prodi]
    );

    if (existingResult.rows.length === 0) {
      throw new Error("Mahasiswa tidak ditemukan");
    }

    if (nama_prodi) {
      const prodiCheckResult = await pool.query(
        "SELECT nama_prodi FROM prodi WHERE nama_prodi = $1",
        [nama_prodi]
      );

      if (prodiCheckResult.rows.length === 0) {
        throw new Error("Program studi tidak ditemukan");
      }
    }
    const updateData = {};
    const params = [];

    if (nama_mahasiswa !== undefined) {
      updateData.nama_mahasiswa = nama_mahasiswa;
    }
    if (nama_prodi !== undefined) {
      updateData.nama_prodi = nama_prodi;
    }
    if (mahasiswa_aktif !== undefined) {
      updateData.mahasiswa_aktif = mahasiswa_aktif;
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error("Tidak ada data yang di update");
    }

    const setUpdate = Object.keys(updateData)
      .map((key, index) => `${key} = $${index + 1}`)
      .join(", ");
    params.push(...Object.values(updateData), nim);

    await pool.query(
      `UPDATE mahasiswa SET ${setUpdate} WHERE nim = $${params.length}`,
      params
    );

    return {
      message: "Mahasiswa berhasil di update",
      data: { nim, ...updateData },
    };
  }

  static async importMahasiswa(excelBuffer, nama_prodi) {
    try {
      const workbook = xlsx.read(excelBuffer, { type: "buffer" });
      const fileType = detectFileType(workbook);

      let parsedStudents;
      if (fileType == "perColumn") {
        parsedStudents = parsePerColumn(workbook, null);
      } else {
        parsedStudents = parsePerSheet(workbook);
      }
      if (parsedStudents.length === 0) {
        throw new Error(
          "Tidak ada data mahasiswa yang valid ditemukan dalam excel"
        );
      }

      const connection = await pool.connect();
      const results = {
        total_processed: parsedStudents.length,
        succesful_imports: 0,
        failed_imports: 0,
        erros: [],
        imported_students: [],
      };

      try {
        await connection.beginTransaction();
        for (const student of parsedStudents) {
          try {
            if (!/^\d+$/.test(student.nim)) {
              results.erros.push({
                nim: student.nim,
                name: student.name,
                error: "NIM harus berupa angka",
              });
              results.failed_imports++;
              continue;
            }

            const existingResult = await connection.query(
              "SELECT nim FROM mahasiswa WHERE nim = $1",
              [student.nim]
            );

            if (existingResult.rows.length > 0) {
              // skip duplicate nim
              results.failed_imports++;
              continue;
            }
            let finalNamaProdi = nama_prodi;

            if (finalNamaProdi) {
              finalNamaProdi = finalNamaProdi.replace(/\s/g, "");
            }

            const academicYear = AdminService.extractAcademicYear(student.nim);
            if (!academicYear) {
              results.erros.push({
                nim: student.nim,
                name: student.name,
                error: "tidak dapat menentukan tahun dari nim",
              });
              results.failed_imports++;
              continue;
            }
            await connection.query(
              "INSERT INTO mahasiswa (nim, nama_mahasiswa, nama_prodi, mahasiswa_aktif) VALUES ($1,$2,$3,$4)",
              [student.nim, student.name.trim(), finalNamaProdi, true]
            );
            results.succesful_imports++;
            results.imported_students.push({
              nim: student.nim,
              name: student.name.trim(),
              nama_prodi: finalNamaProdi,
              class_group: student.class_group,
            });
          } catch (error) {
            results.erros.push({
              nim: student.nim,
              name: student.name,
              error: error.message,
            });
            results.failed_imports++;
          }
        }

        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      return results;
    } catch (error) {
      throw new Error(`Gagal memproses file excel: ${error.message}`);
    }
  }

  static async getCurrentLoans() {
    const query = `
    SELECT
      t.peminjaman_id,
      m.nama_mahasiswa,
      i.tipe_nama_barang,
      t.waktu_checkout,
      t.waktu_pengembalian_dijanjikan,
      EXTRACT(DAY FROM (t.waktu_pengembalian_dijanjikan - NOW())) as days_remaining
      FROM transaksi t
      JOIN mahasiswa m ON t.nim = m.nim
      JOIN inventory i ON t.id_barang = i.id_barang
      WHERE t.status_peminjaman IN ('dipinjam','terlambat')
      ORDER BY t.waktu_checkout DESC
      LIMIT 20
      `;

    const result = await pool.query(query);
    return result.rows;
  }

  static async getAllBorrowTransactions(limit = 10, offset = 0) {
    const countQuery = `
    SELECT COUNT(*) as total FROM transaksi t
    JOIN mahasiswa m ON t.nim = m.nim
    JOIN prodi p ON m.nama_prodi = p.nama_prodi`;

    const countResult = await pool.query(countQuery);
    const total = countResult.rows[0].total;

    const query = `
    SELECT 
      t.peminjaman_id,
      t.nim,
      m.nama_mahasiswa,
      p.nama_prodi,
      i.barcode,
      i.tipe_nama_barang,
      i.brand,
      i.model,
      t.waktu_checkout,
      t.waktu_pengembalian_dijanjikan,
      t.waktu_pengembalian_sebenarnya,
      t.status_peminjaman,
      k.nama_kelas,
      d.nama_dosen,
      r.nomor_ruangan,
      t.notes_checkout,
      t.notes_checkin,
      t.created_at
    FROM transaksi t
    JOIN mahasiswa m ON t.nim = m.nim
    JOIN prodi p ON m.nama_prodi = p.nama_prodi
    LEFT JOIN inventory i ON t.id_barang = i.id_barang
    LEFT JOIN jadwal j ON t.jadwal_id = j.id_jadwal
    LEFT JOIN kelas k ON j.id_kelas = k.id_kelas
    LEFT JOIN dosen d ON j.nip = d.nip
    LEFT JOIN ruangan r ON j.id_ruangan = r.id_ruangan
    ORDER BY t.created_at ASC
    LIMIT $1 OFFSET $2
    `;

    const result = await pool.query(query, [limit, offset]);
    const data = result.rows.map((row) => {
      const metadata = row.notes_checkout ? JSON.parse(row.notes_checkout) : {};
      return {
        ...row,
        lecturer_name: metadata.lecturer_name || row.nama_dosen,
        class_name: metadata.class_name || row.nama_kelas,
      };
    });

    return {
      data: data,
      total: total,
    };
  }

  static async getAllClasses() {
    const query = `
    SELECT 
      id_kelas,
      kode_kelas,
      nama_kelas,
      sks
    FROM kelas
    ORDER BY nama_kelas ASC
    `;

    const result = await pool.query(query);
    return result.rows;
  }
  static async getAllRooms() {
    const query = `
    SELECT 
      id_ruangan,
      nomor_ruangan,
      gedung
    FROM ruangan
    ORDER BY nomor_ruangan ASC
    `;

    const result = await pool.query(query);
    return result.rows;
  }
  static async getAllLecturers() {
    const query = `
    SELECT 
      nip,
      nama_dosen,
      prodi
    FROM dosen
    ORDER BY nama_dosen ASC
    `;

    const result = await pool.query(query);
    return result.rows;
  }
  static async getAllProgramStudies() {
    const query = `
    SELECT 
      nama_prodi,
      kepanjangan_prodi,
      tahun_angkatan
    FROM prodi
    ORDER BY nama_prodi ASC
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  static async getActiveSchedules() {
    const query = `
    SELECT
      j.id_jadwal,
      j.hari_dalam_seminggu,
      j.waktu_mulai,
      j.waktu_berakhir,
      k.nama_kelas,
      d.nama_dosen,
      r.nomor_ruangan
    FROM jadwal j
    LEFT JOIN kelas k ON j.id_kelas = k.id_kelas
    LEFT JOIN dosen d ON j.nip = d.nip
    LEFT JOIN ruangan r ON j.id_ruangan = r.id_ruangan
    ORDER BY
      CASE j.hari_dalam_seminggu
        WHEN 'Senin' THEN 1
        WHEN 'Selasa' THEN 2
        WHEN 'Rabu' THEN 3
        WHEN 'Kamis' THEN 4
        WHEN 'Jumat' THEN 5
        WHEN 'Sabtu' THEN 6
        WHEN 'Minggu' THEN 7
      END,
      j.waktu_mulai ASC
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  static async getClassDetails(prodiName) {
    const prodiInfo = await pool.query(
      "SELECT * FROM prodi WHERE nama_prodi = $1",
      [prodiName]
    );

    if (prodiInfo.rows.length === 0) {
      return null;
    }

    const scheduleInfo = await pool.query(
      `
      SELECT
        STRING_AGG(DISTINCT d.nama_dosen, ', ') as lecturers,
        STRING_AGG(DISTINCT r.nomor_ruangan, ', ') as rooms,
        STRING_AGG(DISTINCT CONCAT(j.hari_dalam_seminggu, ' ', j.waktu_mulai, '-', j.waktu_berakhir), '; ') as schedules
      FROM jadwal j
      LEFT JOIN dosen d ON j.nip = d.nip
      LEFT JOIN ruangan r ON j.id_ruangan = r.id_ruangan
      WHERE j.nama_prodi = $1
      `,
      [prodiName]
    );

    const borrowers = await pool.query(
      `
      SELECT
        m.nama_mahasiswa as student_name,
        m.nim,
        COUNT(t.peminjaman_id) as number_of_times_borrowing,
        STRING_AGG(
          CASE WHEN t.status_peminjaman = 'dikembalikan' THEN
            CONCAT(i.tipe_nama_barang, ' - ', i.brand, ' ', i.model)
          END, '; '
        ) as returned_items,
        STRING_AGG(
          CASE WHEN t.status_peminjaman IN ('dipinjam','terlambat') THEN
            CONCAT(i.tipe_nama_barang, ' - ', i.brand, ' ', i.model)
          END, '; '
        ) as unreturned_items,
         CASE
          WHEN COUNT(CASE WHEN t.status_peminjaman IN ('dipinjam', 'terlambat') THEN 1 END) > 0 THEN 'active_borrower'
          ELSE 'inactive_borrower'
        END as borrower_type,
        MAX(t.waktu_checkout) as last_borrow_time,
        COUNT(CASE WHEN t.status_peminjaman IN ('dipinjam','terlambat') THEN 1 END) as active_loans
        FROM mahasiswa m
        LEFT JOIN transaksi t ON m.nim = t.nim
        LEFT JOIN inventory i ON t.id_barang = i.id_barang
        WHERE m.nama_prodi = $1
        GROUP BY m.nim, m.nama_mahasiswa
        ORDER BY active_loans DESC, number_of_times_borrowing DESC, m.nama_mahasiswa ASC
      `,
      [prodiName]
    );

    const borrowersWithLoans = borrowers.rows.filter(
      (b) => b.number_of_times_borrowing > 0
    );
    const totalBorrowers = borrowersWithLoans.length;
    const activeBorrowers = borrowersWithLoans.filter(
      (b) => b.active_loans > 0
    );
    const completedBorrowers = totalBorrowers - activeBorrowers;

    return {
      class_info: {
        ...prodiInfo.rows[0],
        lecturers:
          prodiInfo.rows[0].lecturer ||
          scheduleInfo.rows[0]?.lecturers ||
          "N/A",
        rooms: prodiInfo.rows[0].room || scheduleInfo.rows[0].rooms || "N/A",
        schedules:
          prodiInfo.rows[0].schedule || scheduleInfo.rows[0].schedules || "N/A",
      },
      borrowers: borrowers.rows,
      statistics: {
        total_borrowers: totalBorrowers,
        active_borrowers: activeBorrowers,
        completed_borrowers: completedBorrowers,
      },
    };
  }
}

export default AdminService;
