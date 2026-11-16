# Panduan Docker & Deployment — Absensi Outsourcing PTBA

Dokumen ini adalah panduan praktis untuk menjalankan dan men-deploy sistem absensi menggunakan Docker.

---

## 1. Arsitektur Container

Sistem diatur dalam 3 service yang saling terhubung otomatis melalui internal Docker network:

```
                  ┌──────────────────────┐
                  │    absensi_db        │ (PostgreSQL 16)
                  │    Port: 5432        │
                  └──────────▲───────────┘
                             │ (DB_HOST=db)
                             │
┌─────────────────┐  HTTP    │    HTTP (callback)  ┌──────────────────────┐
│  absensi_backend├──────────┴────────────────────►│  absensi_face        │
│  Port: 3000     │◄───────────────────────────────┤  Port: 5000          │
└────────┬────────┘      (FACE_URL=                └──────────┬───────────┘
         │            http://face-detector:5000)              │
         │                                                    │
         └─────────────► [ ./uploads ] ◄──────────────────────┘
                     (Shared Volume Foto)
```

---

## 2. Cheat Sheet Perintah Docker

Semua perintah dijalankan di dalam folder `absensi/`:

| Kebutuhan | Perintah |
|---|---|
| **Menyalakan semua service (background)** | `docker compose up -d` |
| **Menyalakan + Rebuild (setelah ubah kode)** | `docker compose up -d --build` |
| **Melihat status container** | `docker compose ps` |
| **Melihat log real-time semua service** | `docker compose logs -f` |
| **Melihat log backend saja** | `docker compose logs -f backend` |
| **Melihat log face detector saja** | `docker compose logs -f face-detector` |
| **Mematikan semua service** | `docker compose down` |
| **Mematikan + Hapus database (reset total)** | `docker compose down -v` |

---

## 3. Langkah Deploy di Server Baru (VPS / Server On-Premise)

### Langkah 1: Pastikan Docker & Docker Compose Terpasang
```bash
docker --version
docker compose version
```

### Langkah 2: Clone Repo & Masuk ke Folder Proyek
```bash
git clone <URL_REPO>
cd mobile-attendance-app/absensi
```

### Langkah 3: Siapkan File `.env`
Salin template konfigurasi:
```bash
cp .env.example .env
```
Sesuaikan nilai rahasia di `.env`:
- `JWT_SECRET`: Isi dengan random string yang kuat.
- `INTERNAL_KEY`: Password rahasia antar-service backend & face detector.
- `DB_PASSWORD`: Password PostgreSQL produksi.

### Langkah 4: Jalankan Container
```bash
docker compose up -d --build
```

> **Catatan Otomatis:**
> Backend sudah dikonfigurasi untuk **otomatis menjalankan migrasi schema tabel & seed akun awal** (`adminsdm` / `admin123`) saat pertama kali dinyalakan. Tidak perlu migrasi manual.

### Langkah 5: Verifikasi Service Berjalan
```bash
# Cek health backend
curl http://localhost:3000/health

# Cek health face detector
curl http://localhost:5000/health
```

---

## 4. Tips Development: Kapan Pakai Docker vs Lokal?

| Situasi | Rekomendasi | Alasan |
|---|---|---|
| **Coding harian di laptop** | Lokal (`npm run dev`) | Reload cepat, hemat RAM laptop (tidak perlu buka Docker Desktop). |
| **Tes integrasi lengkap** | Docker (`docker compose up`) | Memastikan semua service saling bicara sesuai environment produksi. |
| **Deploy ke Server / VPS** | **Wajib Docker** | Terisolasi, tidak ada drama error kompilasi `dlib`/C++ di OS server. |

---

## 5. Troubleshooting Cepat

### Q: Port 5432 / 3000 / 5000 sudah dipakai (Error: `bind: address already in use`)
Ubah port di sisi host pada `.env`:
```env
BACKEND_PORT=3001
FACE_PORT=5001
DB_PORT=5433
```
Lalu jalankan `docker compose up -d`.

### Q: Backend tidak bisa konek ke Database saat start
Container backend sudah dilengkapi `depends_on` dengan `service_healthy`. Backend hanya akan start setelah PostgreSQL benar-benar siap menerima koneksi.

### Q: Foto selfie tidak terbaca oleh Face Detector
Pastikan folder `uploads` tidak terhapus. Keduanya menggunakan mount folder `./uploads` yang sama di host sehingga file selfie yang disimpan backend langsung bisa dibaca face detector.

