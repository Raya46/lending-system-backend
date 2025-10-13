import pool from "../data/db_postgres.js";

class InventoryService {
  static async getAllItems(limit = 10, offset = 0) {
    const countQuery = `SELECT COUNT(*) as total FROM inventory`;
    const countResult = await pool.query(countQuery);
    const total = countResult.rows[0].total;

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
    LIMIT $1 OFFSET $2
    `;
    const result = await pool.query(query, [limit, offset]);
    return {
      data: result.rows,
      total: total,
    };
  }

  static async getAvailableItems() {
    const query = `
       SELECT * FROM inventory
       WHERE status = 'tersedia'
       ORDER BY tipe_nama_barang, brand, model
        `;
    const result = await pool.query(query);
    return result.rows;
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

    await pool.query(
      "INSERT INTO inventory (barcode, tipe_nama_barang, brand, model, serial_number, deskripsi, status, tanggal_pembelian, letak_barang) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
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

    await pool.query(
      "UPDATE inventory SET barcode = $1, tipe_nama_barang = $2, brand = $3, model = $4, serial_number = $5, deskripsi = $6, status = $7, tanggal_pembelian = $8, letak_barang = $9 WHERE id_barang = $10",
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
    const activeLoan = await pool.query(
      "SELECT peminjaman_id FROM transaksi WHERE id_barang = $1 AND status_peminjaman = $2",
      [parseInt(id), "dipinjam"]
    );
    if (activeLoan.rows.length > 0) {
      throw new Error("Item sedang dipinjam, tidak dapat dihapus");
    }
    await pool.query("DELETE FROM inventory WHERE id_barang = $1", [
      parseInt(id),
    ]);

    return {
      message: "Item berhasil dihapus",
    };
  }
}

export default InventoryService;
