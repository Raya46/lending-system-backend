-- #####################################################################
--                  BLOCK 1: TABEL UTAMA & MASTER DATA
-- #####################################################################

-- --- Table 1: Prodi (Class Groups) ---
CREATE TABLE IF NOT EXISTS prodi (
    id_prodi INT AUTO_INCREMENT PRIMARY KEY,
    nama_prodi VARCHAR(20) NOT NULL UNIQUE,
    kepanjangan_prodi VARCHAR(100) NOT NULL,
    tahun_angkatan VARCHAR(9) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- Table 2: Dosen (Lecturers) ---
CREATE TABLE IF NOT EXISTS dosen (
    nip VARCHAR(50) PRIMARY KEY,
    nama_dosen VARCHAR(255) NOT NULL,
    id_prodi INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_prodi) REFERENCES prodi(id_prodi) ON DELETE SET NULL ON UPDATE CASCADE
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
    status ENUM('TERSEDIA', 'HABIS', 'diperbaiki', 'rusak') DEFAULT 'TERSEDIA' NOT NULL,
    tanggal_pembelian DATE NULL,
    location_note VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


-- #####################################################################
--                  BLOCK 2:  TABEL RELASI & APLIKASI
-- #####################################################################

-- --- Table 7: Mahasiswa (Students) ---
-- REVISI: Mengembalikan NIM sebagai Primary Key sesuai permintaan.
CREATE TABLE IF NOT EXISTS mahasiswa (
    nim VARCHAR(50) PRIMARY KEY NOT NULL,
    nama_mahasiswa VARCHAR(255) NOT NULL,
    id_prodi INT NULL,
    mahasiswa_aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_prodi) REFERENCES prodi(id_prodi) ON DELETE SET NULL ON UPDATE CASCADE
);

-- --- Table 8: Jadwal Akademik (Schedules) ---
CREATE TABLE IF NOT EXISTS jadwal (
    id_jadwal INT AUTO_INCREMENT PRIMARY KEY,
    id_kelas INT NOT NULL,
    nip VARCHAR(50) NOT NULL,
    id_prodi INT NOT NULL,
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
    FOREIGN KEY (id_prodi) REFERENCES prodi(id_prodi) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (id_ruangan) REFERENCES ruangan(id_ruangan) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uc_schedule_slot UNIQUE (nip, id_ruangan, hari_dalam_seminggu, waktu_mulai),
    CONSTRAINT uc_class_schedule_slot UNIQUE (id_prodi, hari_dalam_seminggu, waktu_mulai)
);

-- --- Table 9: Jadwal Peminjaman (Admin Managed Slots) ---
CREATE TABLE IF NOT EXISTS jadwal_peminjaman (
    id_jadwal_peminjaman INT AUTO_INCREMENT PRIMARY KEY,
    nama_jadwal VARCHAR(255) NOT NULL, 
    hari ENUM('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu') NOT NULL,
    waktu_mulai TIME NOT NULL,
    waktu_berakhir TIME NOT NULL,
    aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- #####################################################################
--                  BLOCK 3: TABEL TRANSAKSI
-- #####################################################################

-- --- Table 10: Borrow Requests ---
-- REVISI: Mengembalikan Foreign Key ke nim.
CREATE TABLE IF NOT EXISTS borrow_requests (
    id_request INT AUTO_INCREMENT PRIMARY KEY,
    nim VARCHAR(50) NOT NULL,
    id_barang INT NOT NULL,
    id_jadwal_peminjaman INT NULL,
    status ENUM('menunggu', 'disetujui', 'ditolak') DEFAULT 'menunggu' NOT NULL,
    alasan_penolakan TEXT NULL,
    admin_id_peninjau INT NULL,
    tanggal_keputusan DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (nim) REFERENCES mahasiswa(nim) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (id_barang) REFERENCES inventory(id_barang) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (admin_id_peninjau) REFERENCES admin_users(admin_id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (id_jadwal_peminjaman) REFERENCES jadwal_peminjaman(id_jadwal_peminjaman) ON DELETE SET NULL ON UPDATE CASCADE
);

-- --- Table 11: Transaksi (Loans) ---
-- REVISI: Mengembalikan Foreign Key ke nim.
CREATE TABLE IF NOT EXISTS transaksi (
    id_peminjaman INT AUTO_INCREMENT PRIMARY KEY,
    nim VARCHAR(50) NOT NULL,
    id_barang INT NOT NULL,
    id_jadwal_peminjaman INT NULL,
    admin_id_checkout INT NOT NULL,
    checkout_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    waktu_pengembalian_dijanjikan DATETIME NOT NULL,
    waktu_pengembalian_sebenarnya DATETIME NULL,
    admin_id_checkin INT NULL,
    status_peminjaman ENUM('DIPINJAM', 'DIKEMBALIKAN', 'HARUS_KEMBALIKAN') DEFAULT 'DIPINJAM' NOT NULL,
    notes_checkout TEXT NULL,
    notes_checkin TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (nim) REFERENCES mahasiswa(nim) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (id_barang) REFERENCES inventory(id_barang) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (id_jadwal_peminjaman) REFERENCES jadwal_peminjaman(id_jadwal_peminjaman) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (admin_id_checkout) REFERENCES admin_users(admin_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (admin_id_checkin) REFERENCES admin_users(admin_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- #####################################################################
--                  BLOCK 4: DATA AWAL (SEEDING)
-- #####################################################################

-- --- insert data untuk prodi ---
INSERT INTO prodi (nama_prodi, kepanjangan_prodi, tahun_angkatan) VALUES
('TL24A', 'Teknik Listrik 24A', '2024/2025'),
('TL24B', 'Teknik Listrik 24B', '2024/2025'),
('TL24C', 'Teknik Listrik 24C', '2024/2025'),
('TL24D', 'Teknik Listrik 24D', '2024/2025'),
('TL23A', 'Teknik Listrik 23A', '2023/2024'),
('TL23B', 'Teknik Listrik 23B', '2023/2024'),
('TL23C', 'Teknik Listrik 23C', '2023/2024'),
('TL23D', 'Teknik Listrik 23D', '2023/2024'),
('TL22A', 'Teknik Listrik 22A', '2022/2023'),
('TL22B', 'Teknik Listrik 22B', '2022/2023'),
('TL22C', 'Teknik Listrik 22C', '2022/2023'),
('TL22D', 'Teknik Listrik 22D', '2022/2023');

-- --- insert data untuk admin_users ---
INSERT IGNORE INTO admin_users (username, password_hash) 
VALUES ('admin', '$2b$10$AIwKa3UeP9Ki5sKi4pQ4t.pwggYWl47k48LgscPYqAyG4IVsTsTiu');

