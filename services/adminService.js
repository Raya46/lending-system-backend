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
    SELECT i.tipe_nama_barang as item_name,
    COUNT(t.peminjaman_id) as lent_quantity,
    CASE
        WHEN i.status = "TERSEDIA" THEN 1
        ELSE 0
    END as remaining_quantity
    FROM inventory i
    LEFT JOIN transaksi t on i.id_barang = t.id_barang
        AND t.status_peminjaman IN ('dipinjam')
    GROUP BY i.id_barang, i.tipe_nama_barang, i.status
    ORDER BY lent_quantity DESC
    LIMIT 10
    `;

    const [rows] = await pool.execute(query);
    return rows;
  }

  static async getLowStockItems() {
    const LOW_STOCK = 15;
    const query = `
    SELECT i.tipe_nama_barang as item_name,
    CASE
        WHEN i.status = 'TERSEDIA' THEN 1
        ELSE 0
    END as remaining_quantity,
    'LOW' as status
    FROM inventory i
    WHERE i.status = 'TERSEDIA'
    GROUP BY i.id_barang, i.tipe_nama_barang
    HAVING remaining_quantity <= ?
    ORDER BY remaining_quantity ASC
    `;

    const [rows] = await pool.execute(query);
    return rows;
  }

  static async getInventorySummary() {
    const queries = [
      'SELECT COUNT(*) as quantity_in_hand FROM inventory WHERE status = "TERSEDIA" ',
      'SELECT COUNT(*) as to_be_received FROM borrow_requests WHERE status = "disetujui" ',
    ];

    const results = await Promise.all(
      queries.map((query) => pool.execute(query))
    );

    return {
      quantity_in_hand: results[0][0][0].quantity_in_hand,
      to_be_received: results[1][0][0].to_be_received,
    };
  }

  static async getInventoryData() {
    const query = `
    SELECT i.tipe_nama_barang as item_name,
    COUNT(t.peminjaman_id) as lent_quantity,
    CASE
        WHEN i.status = 'TERSEDIA' THEN 1
        ELSE 0
    END as remaining_quantity,
    1 as total_quantity,
    CASE
        WHEN i.status = 'TERSEDIA' AND COUNT(t.peminjaman_id) >= 15 THEN 'in-stock'
        WHEN i.status = 'TERSEDIA' AND COUNT(t.peminjaman_id) < 15 THEN 'low-stock'
        ELSE 'out-of-stock'
    END as availablity
    FROM inventory i
    LEFT JOIN transaksi t ON i.id_barang = t.id_barang
    AND t.status_peminjaman IN ('dipinjam')
    GROUP BY i.id_barang, i.tipe_nama_barang, i.status
    ORDER BY i.tipe_nama_barang ASC
    `;

    const [rows] = await pool.execute(query);
    return rows;
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
}

export default AdminService;
