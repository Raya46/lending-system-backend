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

    const insertFields = [];
    const insertValues = [];
    const placeholders = [];

    if (barcode !== undefined) {
      insertFields.push("barcode");
      insertValues.push(barcode || null);
      placeholders.push("?");
    }
    if (tipe_nama_barang !== undefined) {
      insertFields.push("tipe_nama_barang");
      insertValues.push(tipe_nama_barang || null);
      placeholders.push("?");
    }
    if (brand !== undefined) {
      insertFields.push("brand");
      insertValues.push(brand || null);
      placeholders.push("?");
    }
    if (model !== undefined) {
      insertFields.push("model");
      insertValues.push(model || null);
      placeholders.push("?");
    }
    if (serial_number !== undefined) {
      insertFields.push("serial_number");
      insertValues.push(serial_number || null);
      placeholders.push("?");
    }
    if (deskripsi !== undefined) {
      insertFields.push("deskripsi");
      insertValues.push(deskripsi || null);
      placeholders.push("?");
    }
    if (status !== undefined) {
      insertFields.push("status");
      insertValues.push(status || null);
      placeholders.push("?");
    }
    if (tanggal_pembelian !== undefined) {
      insertFields.push("tanggal_pembelian");
      insertValues.push(tanggal_pembelian || null);
      placeholders.push("?");
    }
    if (letak_barang !== undefined) {
      insertFields.push("letak_barang");
      insertValues.push(letak_barang || null);
      placeholders.push("?");
    }

    if (insertFields.length === 0) {
      throw new Error("No valid fields to insert");
    }

    const query = `INSERT INTO inventory (${insertFields.join(
      ", "
    )}) VALUES (${placeholders.join(", ")})`;

    const [result] = await pool.execute(query, insertValues);

    return result.insertId;
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

    const [currentItem] = await pool.execute(
      "SELECT status FROM inventory WHERE id_barang = ?",
      [id]
    );

    if (currentItem.length === 0) {
      throw new Error("Item tidak ditemukan");
    }

    const currentStatus = currentItem[0].status;
    const newStatus = status;

    const updateFields = [];
    const updateValues = [];

    if (barcode !== undefined) {
      updateFields.push("barcode = ?");
      updateValues.push(barcode || null);
    }
    if (tipe_nama_barang !== undefined) {
      updateFields.push("tipe_nama_barang = ?");
      updateValues.push(tipe_nama_barang || null);
    }
    if (brand !== undefined) {
      updateFields.push("brand = ?");
      updateValues.push(brand || null);
    }
    if (model !== undefined) {
      updateFields.push("model = ?");
      updateValues.push(model || null);
    }
    if (serial_number !== undefined) {
      updateFields.push("serial_number = ?");
      updateValues.push(serial_number || null);
    }
    if (deskripsi !== undefined) {
      updateFields.push("deskripsi = ?");
      updateValues.push(deskripsi || null);
    }
    if (status !== undefined) {
      updateFields.push("status = ?");
      updateValues.push(status || null);
    }
    if (tanggal_pembelian !== undefined) {
      updateFields.push("tanggal_pembelian = ?");
      updateValues.push(tanggal_pembelian || null);
    }
    if (letak_barang !== undefined) {
      updateFields.push("letak_barang = ?");
      updateValues.push(letak_barang || null);
    }

    if (updateFields.length === 0) {
      throw new Error("No valid fields to update");
    }

    const query = `UPDATE inventory SET ${updateFields.join(
      ", "
    )} WHERE id_barang = ?`;
    updateValues.push(id);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(query, updateValues);

      // handle status change logic
      if (newStatus !== undefined && newStatus !== currentStatus) {
        if (newStatus === "tersedia") {
          const [activeTransaction] = await connection.execute(
            'SELECT peminjaman_id, nim FROM transaksi WHERE id_barang = ? AND status_peminjaman = "dipinjam"',
            [id]
          );

          if (activeTransaction.length > 0) {
            console.log(
              `Auto returning ${activeTransaction.length} for item ${id}`
            );

            await connection.execute(
              'UPDATE transaksi SET status_peminjaman = "dikembalikan", waktu_pengembalian_sebenarnya = NOW(), notes_checkin = "Otomatis dikembalikan: Status item diubah menjadi tersedia" WHERE id_barang = ? AND status_peminjaman = "dipinjam"',
              [id]
            );
          }
        }
      }

      await connection.commit();
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async deleteItem(id) {
    const [itemExists] = await pool.execute(
      "SELECT id_barang, tipe_nama_barang, status FROM inventory WHERE id_barang = ?",
      [id]
    );

    if (itemExists.length === 0) {
      throw new Error("Item tidak ditemukan");
    }

    const item = itemExists[0];

    if (item.status === "dipinjam") {
      throw new Error(
        "Item sedang dipinjam, tidak dapat dihapus. Item harus dikembalikan terlebih dahulu"
      );
    }

    const [activeLoan] = await pool.execute(
      'SELECT peminjaman_id, nim FROM transaksi WHERE id_barang = ? AND status_peminjaman = "dipinjamn"',
      [id]
    );

    if (activeLoan.length > 0) {
      throw new Error(
        "Item sedang dipinjam, tidak dapat dihapus. Item harus dikembalikan terlebih dahulu"
      );
    }
    try {
      const [result] = await pool.execute(
        "DELETE FROM inventory WHERE id_barang = ?",
        [id]
      );

      return result.affectedRows > 0;
    } catch (error) {
      if (error.code === "ER_ROW_IS_REFERENCED_@") {
        throw new Error(
          "Item tidak dapat dihapus karena masih memiliki referensi di table lain"
        );
      }
      throw error;
    }
  }
}

export default InventoryService;
