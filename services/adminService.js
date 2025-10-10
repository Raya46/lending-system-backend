import pool from "../data/db_setting.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import xlsx from "xlsx";
import {
  detectFileType,
  parsePerColumn,
  parsePerSheet,
} from "../utils/excelParser.mjs";
class AdminService {
  // function untuk login admin
  static async login(username, password) {
    const [users] = await pool.execute(
      "SELECT * FROM admin_users WHERE username = ?",
      [username]
    );

    if (users.length === 0) {
      throw new Error("Username tidak ditemukan");
    }
    const user = users[0];
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

    const [rows] = await pool.execute(query);

    const itemsWithRemaining = await Promise.all(
      rows.map(async (item) => {
        const [remainingQuery] = await pool.execute(
          'SELECT COUNT(*) as remaining FROM inventory WHERE tipe_nama_barang = ? AND status = "tersedia"',
          [item.name]
        );
        return {
          name: item.name,
          lentQuantity: item.lent_quantity,
          remainingQuantity: remainingQuery[0].remaining || 0,
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

    const [rows] = await pool.execute(query);
    return rows.map((item) => ({
      name: item.name,
      remainingQuantity: item.remainingQuantity,
      status: item.remaining_quantity <= 5 ? "Critical" : "Low",
    }));
  }

  static async getInventorySummary() {
    const [summary] = await pool.execute(`
      SELECT 
        COUNT(CASE WHEN status = 'tersedia' THEN 1 END) as quantity_in_hand,
        COUNT(CASE WHEN status IN ('dipinjam','diperbaiki') THEN 1 END) as to_be_received
      FROM inventory
      `);

    return {
      quantityInHand: summary[0].quantity_in_hand,
      toBeReceived: summary[0].to_be_received,
    };
  }

  static async getInventoryData() {
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
    `;

    const [rows] = await pool.execute(query);
    return rows.map((item) => ({
      ...item,
      lentQuantity: `${item.lent_quantity} Pieces`,
      remainingQuantity: `${item.remaining_quantity} Pieces`,
      totalQuantity: `${item.total_quantity} Pieces`,
      expiryDate: item.latest_purchase_date
        ? new Date(item.latest_purchase_date).toLocaleDateString("id-ID")
        : "N/A",
    }));
  }

  static async getClassOverview() {
    const queries = [
      "SELECT COUNT(*) as total_classes FROM prodi",
      "SELECT COUNT(*) as total_students FROM mahasiswa",
      'SELECT COUNT(*) as active_loans FROM transaksi WHERE status_peminjaman = "dipinjam"',
      'SELECT COUNT(DISTINCT p.nama_prodi) as active_classes FROM prodi p JOIN mahasiswa m ON p.nama_prodi = m.nama_prodi JOIN transaksi t ON m.nim = t.nim WHERE t.status_peminjaman IN ("dipinjam")',
    ];

    const results = await Promise.all(
      queries.map((query) => pool.execute(query))
    );
    return {
      total_classes: results[0][0][0].total_classes,
      total_students: results[1][0][0].total_students,
      active_loans: results[2][0][0].active_loans,
      active_classes: results[3][0][0].active_classes,
    };
  }

  static async getClassesTable(limit = 10, offset = 0) {
    const countQuery = `SELECT COUNT(*) as total FROM prodi`;
    const [countResult] = await pool.execute(countQuery);
    const total = countResult[0].total;
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
    LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.execute(query, [limit, offset]);
    return {
      data: rows,
      total: total,
    };
  }

  static async createMahasiswa(mahasiswaData) {
    const { nim, nama_mahasiswa, nama_prodi } = mahasiswaData;

    const [existing] = await pool.execute(
      "SELECT nim FROM mahasiswa WHERE nim = ?",
      [nim]
    );

    if (existing.length > 0) {
      throw new Error("NIM sudah terdaftar");
    }

    const [prodiCheck] = await pool.execute(
      "SELECT nama_prodi FROM prodi WHERE nama_prodi = ?",
      [nama_prodi]
    );

    if (prodiCheck.length === 0) {
      throw new Error("Program studi tidak ditemukan");
    }

    await pool.execute(
      "INSERT INTO mahasiwa (nim,nama_mahasiwa,nama_prodi,mahasiswa_aktif) VALUES (?,?,?,1)",
      [nim, nama_mahasiswa, nama_prodi]
    );

    return {
      message: "Mahasiswa berhasil dibuat",
      data: { nim, nama_mahasiswa, nama_prodi },
    };
  }

  static async getMahasiswaByProgramStudy(nama_prodi, limit = 10, offset = 0) {
    const [prodiCheck] = await pool.execute(
      "SELECT nama_prodi FROM prodi WHERE nama_prodi = ?",
      [nama_prodi]
    );

    if (prodiCheck.length === 0) {
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
      WHERE m.nama_prodi = ?
      GROUP BY m.nim, m.nama_mahasiswa, m.mahasiswa_aktif, m.created_at, p.kepanjangan_prodi
      ORDER BY m.nama_mahasiswa ASC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.execute(query, [nama_prodi, limit, offset]);
    return {
      programStudi: prodiCheck[0],
      mahasiswa: rows,
      total: rows.length,
    };
  }

  static async updateMahasiswa(nim, mahasiswaData) {
    const { nama_mahasiswa, nama_prodi, mahasiswa_aktif } = mahasiswaData;

    const [existing] = await pool.execute(
      "SELECT nama_prodi FROM prodi WHERE nama_prodi = ?",
      [nama_prodi]
    );

    if (existing.length === 0) {
      throw new Error("Mahasiswa tidak ditemukan");
    }

    if (nama_prodi) {
      const [prodiCheck] = await pool.execute(
        "SELECT nama_prodi FROM prodi WHERE nama_prodi = ?",
        [nama_prodi]
      );

      if (prodiCheck.length === 0) {
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
      .map((key) => `${key} = ?`)
      .join(", ");
    params.push(...Object.values(updateData), nim);

    await pool.execute(
      `UPDATE mahasiswa SET ${setUpdate} WHERE nim = ?`,
      params
    );

    return {
      message: "Mahasiswa berhasil di update",
      data: { nim, ...updateData },
    };
  }

  // static async bulkImportMahasiswa(
  //   excelBuffer,
  //   name_prodi = null,
  //   fileName = ""
  // ) {
  //   try {
  //     const workbook = xlsx.read(excelBuffer, { type: "buffer" });
  //     const fileType = detectFileType(workbook);

  //     let parsedStudents;

  //     if (fileType === "perColumn") {
  //       parsedStudents = parsePerColumn(workbook, fileName);
  //     } else {
  //       parsedStudents = parsePerSheet(workbook);
  //     }
  //     if (parsedStudents.length === 0) {
  //       throw new Error("Tidak ada data mahasiswa yang valid dalam excel");
  //     }

  //     const connection = await pool.getConnection();
  //     const results = {
  //       total_processed: parsedStudents.length,
  //       successful_imports: 0,
  //       failed_imports: 0,
  //       errors: [],
  //       imported_students: [],
  //     };

  //     try {
  //       await connection.beginTransaction();

  //       for (const student of parsedStudents) {
  //         if (!/^\d+$/.test(student.nim)) {
  //           results.errors.push({
  //             nim: student.nim,
  //             name: student.name,
  //             error: "NIM harus berupa angka",
  //           });
  //           results.failed_imports++;
  //           continue;
  //         }
  //         const [existing] = await connection.execute(
  //           "SELECT nim FROM mahasiswa WHERE nim = ?",
  //           [student.nim]
  //         );

  //         if (existing.length > 0) {
  //           results.failed_imports++;
  //           continue;
  //         }

  //         let finalNamaProdi = nama_prodi;
  //         if (!finalNamaProdi && student.class_group) {
  //           const prodiMatch = student.class_group.match(
  //             /^([A-Z]{2}\d{2}[A-Z])/
  //           );
  //           if (prodiMatch) {
  //             finalNamaProdi = prodiMatch[1];
  //           } else {
  //             finalNamaProdi = student.class_group;
  //           }
  //         }

  //         if (finalNamaProdi) {
  //           finalNamaProdi = finalNamaProdi.replace(/\s/g, "");
  //         }

  //         if (!finalNamaProdi) {
  //           results.errors.push({
  //             nim: student.nim,
  //             name: student.name,
  //             error: "Tidak dapat menentukan program studi",
  //           });
  //           results.failed_imports++;
  //           continue;
  //         }

  //       }
  //     } catch (error) {}
  //   } catch (error) {}
  // }

  static async getCurrentLoans() {
    const query = `
    SELECT 
      t.peminjaman_id,
      m.nama_mahasiswa,
      i.tipe_nama_barang,
      t.waktu_checkout,
      t.waktu_pengembalian_dijanjikan,
      TIMESTAMPDIFF(DAY, NOW(), t.waktu_pengembalian_dijanjikan) as days_remaining
      FROM transaksi t
      JOIN mahasiswa m ON t.nim = m.nim
      JOIN inventory i ON t.id_barang = i.id_barang
      WHERE t.status_peminjaman IN ('dipinjam','terlambat')
      ORDER BY t.waktu_checkout DESC
      LIMIT 20
      `;

    const [rows] = await pool.execute(query);
    return rows;
  }

  static async getAllBorrowTransactions(limit = 10, offset = 0) {
    const countQuery = `
    SELECT COUNT(*) as total FROM transaksi t
    JOIN mahasiswa m ON t.nim = m.nim
    JOIN prodi p ON m.nama_prodi = p.nama_prodi`;

    const [countResult] = await pool.execute(countQuery);
    const total = countResult[0].total;

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
    LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.execute(query, [limit, offset]);
    const data = rows.map((row) => {
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

    const [rows] = await pool.execute(query);
    return rows;
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

    const [rows] = await pool.execute(query);
    return rows;
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

    const [rows] = await pool.execute(query);
    return rows;
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

    const [rows] = await pool.execute(query);
    return rows;
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

    const [rows] = await pool.execute(query);
    return rows;
  }

  static async getClassDetails(prodiName) {
    const [prodiInfo] = await pool.execute(
      "SELECT * FROM prodi WHERE nama_prodi = ?",
      [prodiName]
    );

    if (prodiInfo.length === 0) {
      return null;
    }

    const [scheduleInfo] = await pool.execute(
      `
      SELECT
        GROUP_CONCAT(DISTINCT d.nama_dosen SEPARATOR ', ') as lecturers,
        GROUP_CONCAT(DISTINCT r.nomor_ruangan SEPARATOR ', ') as rooms,
        GROUP_CONCAT(DISTINCT CONCAT(j.hari_dalam_seminggu, ' ', j.waktu_mulai, '-', j.waktu_berakhir) SEPARATOR '; ') as schedules
      FROM jadwal j
      LEFT JOIN dosen d ON j.nip = d.nip
      LEFT JOIN ruangan r ON j.id_ruangan = r.id_ruangan
      WHERE j.nama_prodi = ?
      `,
      [prodiName]
    );

    const [borrowers] = await pool.execute(
      `
      SELECT
        m.nama_mahasiswa as student_name,
        m.nim,
        COUNT(t.peminjaman_id) as number_of_times_borrowing,
        GROUP_CONCAT(
          CASE WHEN t.status_peminjaman = 'dikembalikan' THEN
            CONCAT(i.tipe_nama_barang, ' - ', i.brand, ' ', i.model)
          END SEPARATOR '; '
        ) as returned_items,
        GROUP_CONCAT(
          CASE WHEN t.status_peminjaman IN ('dipinjam','terlambat') THEN
            CONCAT(i.tipe_nama_barang, ' - ', i.brand, ' ', i.model)
          END SEPARATOR '; '
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
        WHERE m.nama_prodi = ?
        GROUP BY m.nim, m.nama_mahasiswa
        ORDER BY active_loans DESC, number_of_times_borrowing DESC, m.nama_mahasiswa ASC
      `,
      [prodiName]
    );

    const borrowersWithLoans = borrowers.filter(
      (b) => b.number_of_times_borrowing > 0
    );
    const totalBorrowers = borrowersWithLoans.length;
    const activeBorrowers = borrowersWithLoans.filter(
      (b) => b.active_loans > 0
    );
    const completedBorrowers = totalBorrowers - activeBorrowers;

    return {
      class_info: {
        ...prodiInfo[0],
        lecturers: prodiInfo[0].lecturer || scheduleInfo[0]?.lecturers || "N/A",
        rooms: prodiInfo[0].room || scheduleInfo[0].rooms || "N/A",
        schedules: prodiInfo[0].schedule || scheduleInfo[0].schedules || "N/A",
      },
      borrowers: borrowers,
      statistics: {
        total_borrowers: totalBorrowers,
        active_borrowers: activeBorrowers,
        completed_borrowers: completedBorrowers,
      },
    };
  }
}

export default AdminService;
