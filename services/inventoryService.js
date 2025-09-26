import pool from "../data/db_setting.js";

class InventoryService {
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
