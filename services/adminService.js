import pool from "../data/db_setting.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

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
      process.env.JWT_SECRET || "secret",
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

  static async getClassesTable() {
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
    `;
    const [rows] = await pool.execute(query);
    return rows;
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
}

export default AdminService;
