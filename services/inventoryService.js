import pool from "../data/db_setting.js";

class InventoryService {
  static async getAllItems(limit = 10, offset = 0) {
    const countQuery = `SELECT COUNT(*) as total FROM inventory`;
    const [countResult] = await pool.execute(countQuery);
    const total = countResult[0].total;

    const query = `
    SELECT i.*, 
    CASE
      WHEN t.peminjaman_id IS NOT NULL THEN m.nama_mahasiswa
      ELSE NULL
    END as dipinjam_oleh,
    CASE 
      WHEN t.peminjaman_id IS NOT NULL THEN t.waktu_pengembalian_dijanjikan
      ELSE NULL
    END as due_date
    FROM inventory i
    LEFT JOIN transaksi t ON i.id_barang = t.id_barang
      AND t.status_peminjaman = 'dipinjam'
    LEFT JOIN mahasiswa m ON t.nim = m.nim
    ORDER BY i.created_at DESC
    LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.execute(query, [limit, offset]);
    return {
      data: rows,
      total: total,
    };
  }

  static async getAvailableItems() {
    const query = `
       SELECT * FROM inventory
       WHERE status = 'tersedia'
       ORDER BY tipe_nama_barang, brand, model
        `;
    const [rows] = await pool.execute(query);
    return rows;
  }

  static async createItem(itemData) {
    const {
      barcode,
      tipe_nama_barang,
      brand,
      model,
      serial_number,
      deskripsi,
      status,
      tanggal_pembelian,
      letak_barang,
    } = itemData;

    await pool.execute(
      "INSERT INTO inventory (barcode, tipe_nama_barang, brand, model, serial_number, deskripsi, status, tanggal_pembelian, letak_barang) VALUES (?,?,?,?,?,?,?,?,?)",
      [
        barcode,
        tipe_nama_barang,
        brand,
        model,
        serial_number,
        deskripsi,
        status,
        tanggal_pembelian,
        letak_barang,
      ]
    );

    return {
      message: "Item berhasil dibuat",
      data: itemData,
    };
  }

  static async updateItem(id, itemData) {
    const {
      barcode,
      tipe_nama_barang,
      brand,
      model,
      serial_number,
      deskripsi,
      status,
      tanggal_pembelian,
      letak_barang,
    } = itemData;

    await pool.execute(
      "UPDATE inventory SET barcode = ?, tipe_nama_barang = ?, brand = ?, model = ?, serial_number = ?, deskripsi = ?, status = ?, tanggal_pembelian = ?, letak_barang = ? WHERE id_barang = ?",
      [
        barcode,
        tipe_nama_barang,
        brand,
        model,
        serial_number,
        deskripsi,
        status,
        tanggal_pembelian,
        letak_barang,
        parseInt(id),
      ]
    );

    return {
      message: "Item berhasil di update",
      data: itemData,
    };
  }

  static async deleteItem(id) {
    const [activeLoan] = await pool.execute(
      'SELECT peminjaman_id FROM transaksi WHERE id_barang = ? AND status_peminjaman = "dipinjam"',
      [parseInt(id)]
    );
    if (activeLoan.length > 0) {
      throw new Error("Item sedang dipinjam, tidak dapat dihapus");
    }
    await pool.execute("DELETE FROM inventory WHERE id_barang = ?", [
      parseInt(id),
    ]);

    return {
      message: "Item berhasil dihapus",
    };
  }
}

export default InventoryService;
