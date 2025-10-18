# Sistem Peminjaman Barang (Lending System)

Sistem peminjaman barang berbasis web yang memungkinkan mahasiswa dan dosen untuk meminjam barang inventaris dengan validasi jadwal dan real-time tracking.

## 🏗️ Arsitektur Sistem

Sistem ini terdiri dari dua komponen utama:

- **Frontend**: React + Vite dengan real-time Socket.IO
- **Backend**: Node.js + Express dengan MySQL database

## 📋 Fitur Utama

### 👤 Manajemen Pengguna

- **Multi-role Support**: Mahasiswa dan Dosen
- **Validasi Jadwal**: Peminjaman hanya bisa dilakukan pada hari yang sesuai dengan jadwal
- **Program Studi Validation**: Mahasiswa hanya bisa meminjam untuk jadwal di program studinya
- **Dosen Validation**: Dosen hanya bisa meminjam untuk jadwal yang mereka ajarkan

### 📦 Manajemen Inventaris

- **Tracking Barang**: Monitor status barang (tersedia, dipinjam, terlambat)
- **Barcode System**: Scan barcode untuk proses peminjaman
- **Low Stock Alert**: Notifikasi untuk barang dengan stok rendah
- **Import/Export**: Import data mahasiswa dari Excel

### 🔄 Proses Peminjaman

- **Request System**: Mahasiswa/dosen mengajukan permintaan peminjaman
- **Admin Approval**: Admin menyetujui permintaan dengan validasi
- **Real-time Notifications**: Socket.IO untuk notifikasi real-time
- **Auto-rejection**: Permintaan otomatis ditolak jika tidak datang dalam 15 menit
- **Direct Lending**: Admin bisa langsung meminjamkan tanpa request

## 🛠️ Teknologi yang Digunakan

### Frontend

- **React 18**: UI framework
- **Vite**: Build tool dan development server
- **Socket.IO Client**: Real-time communication
- **React Router**: Navigasi halaman
- **Tailwind CSS**: Styling

### Backend

- **Node.js**: Runtime environment
- **Express.js**: Web framework
- **MySQL**: Database
- **Socket.IO**: Real-time server
- **Express-validator**: Input validation
- **JWT**: Authentication

## 📁 Struktur Proyek

```
lending-system/
├── lending-system-frontend-2/          # Frontend React App
│   ├── src/
│   │   ├── components/                 # Reusable UI Components
│   │   │   ├── BorrowPage.jsx          # Halaman peminjaman
│   │   │   ├── StudentLendModal.jsx    # Modal peminjaman mahasiswa
│   │   │   ├── LecturerLendModal.jsx   # Modal peminjaman dosen
│   │   │   ├── InventoryTable.jsx      # Tabel inventaris
│   │   │   └── ...                     # Komponen lainnya
│   │   ├── pages/                      # Halaman utama
│   │   │   ├── AdminDashboard.jsx      # Dashboard admin
│   │   │   ├── LoginPage.jsx           # Halaman login
│   │   │   └── ...                     # Halaman lainnya
│   │   ├── hooks/                      # Custom React Hooks
│   │   │   └── useDashboardSocket.js   # Hook untuk Socket.IO
│   │   ├── utils/                      # Utility functions
│   │   │   ├── api.js                  # API calls
│   │   │   └── socket.jsx              # Socket.IO client
│   │   └── main.jsx                    # Entry point
│   └── package.json
└── lending-system-backend-2/           # Backend Node.js App
    ├── controllers/                    # Route controllers
    │   ├── borrowController.js         # Controller peminjaman
    │   ├── adminController.js          # Controller admin
    │   └── inventoryController.js      # Controller inventaris
    ├── services/                       # Business logic
    │   ├── borrowService.js            # Service peminjaman
    │   ├── adminService.js             # Service admin
    │   └── socketService.js            # Service Socket.IO
    ├── utils/                          # Utility functions
    │   ├── borrowUtils.js              # Validasi peminjaman
    │   ├── validation.js               # Input validation
    │   └── authMiddleware.js           # Authentication middleware
    ├── routes/                         # API routes
    │   ├── borrowRoutes.js             # Routes peminjaman
    │   ├── adminRoutes.js              # Routes admin
    │   └── inventoryRoutes.js          # Routes inventaris
    ├── data/                          # Database configuration
    │   └── db_setting.js               # MySQL connection
    └── package.json
```

## 🚀 Instalasi & Setup

### Prerequisites

- Node.js (v16 atau lebih tinggi)
- MySQL Server
- npm atau yarn

### Backend Setup

1. Clone repository

```bash
git clone <repository-url>
cd lending-system/lending-system-backend-2
```

2. Install dependencies

```bash
npm install
```

3. Setup database

```bash
# Import database schema
mysql -u root -p < lending_system_db.sql
```

4. Configure database connection
   Edit `data/db_setting.js` dengan kredensial MySQL Anda

5. Start backend server

```bash
npm start
```

Backend akan berjalan di `http://localhost:3000`

### Frontend Setup

1. Navigasi ke folder frontend

```bash
cd lending-system/lending-system-frontend-2
```

2. Install dependencies

```bash
npm install
```

3. Start development server

```bash
npm run dev
```

Frontend akan berjalan di `http://localhost:5173`

## 📖 Panduan Penggunaan

### Untuk Mahasiswa/Dosen

#### 1. Login

- Buka aplikasi di browser
- Login dengan NIM/NIP dan password

#### 2. Meminjam Barang

- Klik tombol "Pinjam Barang"
- Pilih tipe peminjam (Mahasiswa/Dosen)
- Isi form peminjaman:
  - **Mahasiswa**: Nama, NIM, Program Studi, Kelas, Jadwal
  - **Dosen**: Nama, NIP, Program Studi, Kelas, Jadwal
- Pilih barang yang akan dipinjam
- Setel waktu pengembalian
- Submit permintaan

#### 3. Proses Peminjaman

- Tunggu persetujuan admin (maksimal 15 menit)
- Datang ke meja admin setelah disetujui
- Tunggu admin scan barcode barang
- Ambil barang dan catat waktu pengembalian

### Untuk Admin

#### 1. Login Admin

- Login dengan kredensial admin

#### 2. Dashboard

- **Pending Requests**: Lihat permintaan peminjaman yang menunggu
- **Inventory**: Kelola barang inventaris
- **History**: Lihat riwayat peminjaman
- **Class Log**: Lihat log kelas

#### 3. Memproses Permintaan

- Klik "Accept" untuk menyetujui permintaan
- Scan barcode barang
- Konfirmasi waktu pengembalian
- Selesaikan transaksi

#### 4. Direct Lending

- Gunakan fitur "Direct Lending" untuk meminjamkan langsung tanpa request
- Pilih peminjam dan barang
- Scan barcode dan selesaikan transaksi

## 🔧 Konfigurasi

### Environment Variables

Backend:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=lending_system_db
JWT_SECRET=your_jwt_secret
PORT=3000
```

Frontend:

```env
VITE_API_URL=http://localhost:3000/api
```

### Database Schema

Sistem menggunakan tabel-tabel berikut:

- `mahasiswa`: Data mahasiswa
- `dosen`: Data dosen
- `prodi`: Data program studi
- `kelas`: Data kelas/mata kuliah
- `jadwal`: Jadwal mengajar
- `inventory`: Data barang inventaris
- `transaksi`: Data transaksi peminjaman
- `admin`: Data admin

## 🔄 Alur Kerja Sistem

### Flow Peminjaman Mahasiswa

1. Mahasiswa login ke sistem
2. Mahasiswa mengisi form peminjaman
3. Sistem validasi:
   - Hari jadwal harus sama dengan hari ini
   - Program studi harus sesuai
   - Waktu pengembalian harus di masa depan
4. Permintaan dikirim ke admin
5. Admin menerima notifikasi real-time
6. Admin menyetujui permintaan
7. Mahasiswa menerima notifikasi untuk datang ke admin
8. Admin scan barcode barang
9. Transaksi selesai, barang dipinjam

### Flow Peminjaman Dosen

1. Dosen login ke sistem
2. Dosen mengisi form peminjaman
3. Sistem validasi:
   - Hari jadwal harus sama dengan hari ini
   - Dosen harus mengajar di jadwal tersebut
   - Waktu pengembalian harus di masa depan
4. Permintaan dikirim ke admin
5. Admin menerima notifikasi real-time
6. Admin menyetujui permintaan
7. Dosen menerima notifikasi untuk datang ke admin
8. Admin scan barcode barang
9. Transaksi selesai, barang dipinjam

## 🚨 Validasi & Error Handling

### Validasi Input

- **Nama**: 2-255 karakter
- **NIM/NIP**: 5-50 karakter
- **Program Studi**: 2-50 karakter
- **Kelas**: 2-100 karakter
- **Waktu Pengembalian**: Format datetime yang valid

### Validasi Bisnis

- **Hari Jadwal**: Harus sama dengan hari ini
- **Program Studi**: Mahasiswa hanya bisa pinjam untuk prodinya
- **Dosen Jadwal**: Dosen hanya bisa pinjam untuk jadwal yang diajar
- **Pending Transaction**: Tidak boleh ada lebih dari satu pending request
- **Item Availability**: Barang harus tersedia

### Error Messages

- "Jadwal ini untuk hari Senin, bukan untuk hari ini"
- "Jadwal ini untuk program studi TL22D, bukan untuk BM2A"
- "Anda masih memiliki permintaan pending yang belum selesai"
- "Barang tidak tersedia"

## 🔌 Real-time Features

Sistem menggunakan Socket.IO untuk fitur real-time:

- **New Borrow Request**: Admin menerima notifikasi saat ada permintaan baru
- **Request Accepted**: Mahasiswa/dosen menerima notifikasi saat permintaan disetujui
- **Request Rejected**: Mahasiswa/dosen menerima notifikasi saat permintaan ditolak
- **Auto-rejection**: Sistem otomatis menolak permintaan setelah 15 menit
- **Direct Lending**: Notifikasi saat admin melakukan peminjaman langsung

## 📊 Reporting & Analytics

### Dashboard Admin

- **Top Lending Items**: Barang yang paling sering dipinjam
- **Low Stock Items**: Barang dengan stok rendah
- **Pending Requests**: Permintaan yang menunggu persetujuan
- **Current Loans**: Peminjaman yang sedang berlangsung
- **History Log**: Riwayat semua transaksi

### Export Features

- Export data mahasiswa dari Excel
- Export laporan peminjaman
- Export data inventaris

## 🔐 Security

### Authentication

- JWT token untuk session management
- Password hashing dengan bcrypt
- Role-based access control

### Validation

- Input sanitization dengan express-validator
- SQL injection prevention dengan parameterized queries
- XSS prevention

## 🐛 Troubleshooting

### Common Issues

1. **Timezone Issues**: Pastikan server menggunakan timezone yang benar (Asia/Jakarta)
2. **Socket Connection**: Pastikan frontend dan backend menggunakan port yang benar
3. **Database Connection**: Verifikasi kredensial database di `db_setting.js`

### Debug Mode

Untuk enable debug mode:

```bash
# Backend
DEBUG=* npm start

# Frontend
npm run dev -- --debug
```

## 🤝 Kontribusi

1. Fork repository
2. Buat branch feature (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

Proyek ini dilisensikan under MIT License - lihat file [LICENSE](LICENSE) untuk detailnya.

## 👥 Tim Pengembang

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + MySQL
- **Real-time**: Socket.IO
- **Authentication**: JWT

## 📞 Support

Untuk bantuan atau pertanyaan, silakan hubungi tim pengembang melalui:

- Email: support@lendingsystem.com
- Issue Tracker: [GitHub Issues](https://github.com/username/lending-system/issues)

---

**Terima kasih telah menggunakan Sistem Peminjaman Barang!** 🎉
