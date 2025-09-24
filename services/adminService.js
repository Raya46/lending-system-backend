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
    COUNT(t.id_peminjaman) as lent_quantity,
    CASE
        WHEN i.status = "TERSEDIA" THEN 1
        ELSE 0
    END as remaining_quantity
    FROM inventory i
    LEFT JOIN transaksi t on i.id_barang = t.id_barang
        AND t.status_peminjaman IN ('DIPINJAM','HARUS_KEMBALIKAN')
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
    COUNT(t.id_peminjaman) as lent_quantity,
    CASE
        WHEN i.status = 'TERSEDIA' THEN 1
        ELSE 0
    END as remaining_quantity,
    1 as total_quantity,
    CASE
        WHEN i.status = 'TERSEDIA' AND COUNT(t.id_peminjaman) >= 15 THEN 'in-stock'
        WHEN i.status = 'TERSEDIA' AND COUNT(t.id_peminjaman) < 15 THEN 'low-stock'
        ELSE 'out-of-stock'
    END as availablity
    FROM inventory i
    LEFT JOIN transaksi t ON i.id_barang = t.id_barang
    AND t.status_peminjaman IN ('DIPINJAM','HARUS_KEMBALIKAN')
    GROUP BY i.id_barang, i.tipe_nama_barang, i.status
    ORDER BY i.tipe_nama_barang ASC
    `;

    const [rows] = await pool.execute(query);
    return rows;
  }
}

export default AdminService;
