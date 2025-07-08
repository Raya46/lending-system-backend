-- #####################################################################
--                  BLOCK 1: TABEL UTAMA
-- #####################################################################

-- --- Table 1: Dosen (Lecturers) ---
CREATE TABLE IF NOT EXISTS dosen (
    nip VARCHAR(50) PRIMARY KEY,
    nama_dosen VARCHAR(255) NOT NULL,
    prodi VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- Table 2: Prodi (Class Groups) ---
CREATE TABLE IF NOT EXISTS prodi (
    nama_prodi VARCHAR(20) PRIMARY KEY,
    kepanjangan_prodi VARCHAR(100) NOT NULL,
    tahun_angkatan VARCHAR(9) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- Table 3: Kelas (Subjects) ---
CREATE TABLE IF NOT EXISTS kelas (
    id_kelas INT AUTO_INCREMENT PRIMARY KEY,
    kode_kelas VARCHAR(20) UNIQUE NULL,
    nama_kelas VARCHAR(100) NOT NULL,
    sks TINYINT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- Table 4: Ruangan (Rooms) ---
CREATE TABLE IF NOT EXISTS ruangan (
    id_ruangan INT AUTO_INCREMENT PRIMARY KEY,
    nomor_ruangan VARCHAR(20) NOT NULL UNIQUE,
    gedung VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- Table 5: Admin Users ---
CREATE TABLE IF NOT EXISTS admin_users (
    admin_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nama_lengkap VARCHAR(255) NULL,
    role VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- Table 6: Inventory (Items) ---
CREATE TABLE IF NOT EXISTS inventory (
    id_barang INT AUTO_INCREMENT PRIMARY KEY,
    barcode VARCHAR(255) UNIQUE NOT NULL,
    tipe_nama_barang VARCHAR(100) NOT NULL,
    brand VARCHAR(100) NULL,
    model VARCHAR(100) NULL,
    serial_number VARCHAR(100) UNIQUE NULL,
    deskripsi TEXT NULL,
    status ENUM('tersedia', 'dipinjam', 'diperbaiki', 'rusak') DEFAULT 'tersedia' NOT NULL,
    tanggal_pembelian DATE NULL,
    location_note VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


-- #####################################################################
--                  BLOCK 2:  TABEL RELASI
-- #####################################################################

-- --- Table 7: Mahasiswa (Students) ---
CREATE TABLE IF NOT EXISTS mahasiswa (
    nim VARCHAR(50) PRIMARY KEY NOT NULL,
    nama_mahasiswa VARCHAR(255) NOT NULL,
    nama_prodi VARCHAR(20) NULL,
    mahasiswa_aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (nama_prodi) REFERENCES prodi(nama_prodi) ON DELETE SET NULL ON UPDATE CASCADE
);

-- --- Table 8: Jadwal (Schedules) ---
CREATE TABLE IF NOT EXISTS jadwal (
    id_jadwal INT AUTO_INCREMENT PRIMARY KEY,
    id_kelas INT NOT NULL,
    nip VARCHAR(50) NOT NULL,
    nama_prodi VARCHAR(20) NOT NULL,
    id_ruangan INT NOT NULL,
    hari_dalam_seminggu ENUM('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat') NOT NULL,
    waktu_mulai TIME NOT NULL,
    waktu_berakhir TIME NOT NULL,
    semester VARCHAR(50) NULL,
    tahun_angkatan VARCHAR(9) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_kelas) REFERENCES kelas(id_kelas) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (nip) REFERENCES dosen(nip) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (nama_prodi) REFERENCES prodi(nama_prodi) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (id_ruangan) REFERENCES ruangan(id_ruangan) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uc_schedule_slot UNIQUE (nip, id_ruangan, hari_dalam_seminggu, waktu_mulai),
    CONSTRAINT uc_class_schedule_slot UNIQUE (nama_prodi, hari_dalam_seminggu, waktu_mulai)
);


-- #####################################################################
--                  BLOCK 3: TABEL TRANSAKSI 
-- #####################################################################

-- --- Table 9: Transaksi (Loans) ---
CREATE TABLE IF NOT EXISTS transaksi (
    id_peminjaman INT AUTO_INCREMENT PRIMARY KEY,
    id_barang INT NOT NULL, -- Changed from item_id for consistency
    nim VARCHAR(50) NOT NULL,
    id_jadwal INT NULL,
    admin_id_checkout INT NOT NULL,
    checkout_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    waktu_pengembalian_dijanjikan DATETIME NOT NULL,
    waktu_pengembalian_sebenarnya DATETIME NULL,
    admin_id_checkin INT NULL,
    status_peminjaman ENUM('dipinjam', 'dikembalikan', 'terlambat', 'hilang', 'rusak_saat_pengembalian') DEFAULT 'dipinjam' NOT NULL,
    notes_checkout TEXT NULL,
    notes_checkin TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_barang) REFERENCES inventory(id_barang) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (nim) REFERENCES mahasiswa(nim) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (id_jadwal) REFERENCES jadwal(id_jadwal) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (admin_id_checkout) REFERENCES admin_users(admin_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (admin_id_checkin) REFERENCES admin_users(admin_id) ON DELETE RESTRICT ON UPDATE CASCADE
);