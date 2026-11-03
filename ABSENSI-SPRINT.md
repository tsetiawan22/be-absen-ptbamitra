# Sistem Absensi Outsourcing PTBA — Master Spec & Sprint Plan

> Dokumen tunggal. Kerjakan **satu sprint, satu step per sesi AI**. Baca bagian A dulu, lalu kerjakan step yang ditunjuk. Jika sesi putus, lanjut dari step terakhir yang belum tercentang di bagian D.

## A. Gambaran Umum

### 1. Tech Stack

| Bagian | Teknologi |
|---|---|
| Backend | Node.js + **TypeScript** + **NestJS**, port **3000** |
| Database | **PostgreSQL** (lib `pg`, tanpa ORM) |
| Face Detector | **Python** + FastAPI + `face_recognition`, port **5000** |
| Dev runner | `nest start --watch` / `ts-node` (backend) + `uvicorn --reload` (python), dijalankan bareng via `concurrently` |

### 2. Gaya Pemrograman (WAJIB)

- Simple & modular dengan NestJS. Hindari boilerplate berlebih.
- Struktur per fitur: `module -> controller -> service -> db query (pg raw SQL)`.
- Raw SQL dengan `pg` (parameterized `$1, $2`, tanpa ORM).
- Nama variabel & komentar boleh Bahasa Indonesia atau Inggris, konsisten.
- Respon seragam format JSON `{ success, message, data }`.
- Jangan tambah library di luar yang tertulis di spec tanpa alasan.

### 3. Role (dari use case diagram)

| Role (kode) | Aktor di diagram | Hak akses |
|---|---|---|
| `admin_sdm` | Admin SDM PTBA | Login, buat akun admin mitra, lihat laporan |
| `admin_outsourcing` | Admin Outsourcing (admin mitra) | Login, buat akun koordinator, buat akun user, edit akun user, lihat recap absensi |
| `koordinator` | Koordinator lapangan | Login, buat akun user, edit akun user, lihat recap absensi |
| `user` | User (pekerja) | Login, melakukan absen, edit profile |

Semua use case memakai `<<include>> LOGIN` → semua endpoint (kecuali login) butuh JWT.

> Asumsi: "Admin mitra" = `admin_outsourcing`. Jika berbeda, ubah di Step 02.

### 4. Alur Absensi (INTI SISTEM)

```
[User/App]
   | 1. POST /api/absensi  (foto selfie + latitude + longitude)
   v
[Backend :3000]
   | 2. simpan absensi status = "pending"
   | 3. POST http://localhost:5000/verify
   |      (foto absen, foto referensi user, lat, lng, lokasi kerja + radius, absensi_id)
   v
[Face Detector :5000]
   | 4. VALIDASI 1: wajah cocok? (face match)
   | 5. VALIDASI 2: lokasi dalam radius? (haversine)
   | 6. POST http://localhost:3000/internal/absensi/callback
   |      (absensi_id, face_valid, lokasi_valid, score, jarak)
   v
[Backend :3000]
   | 7. validasi data callback (secret key, absensi ada, masih pending)
   | 8. status = "berhasil" jika face_valid && lokasi_valid, selain itu "gagal"
   v
[User] cek hasil: GET /api/absensi/:id
```

Poin penting:
- Backend dan Face Detector **independen**. Kalau face detector mati, absensi tetap tersimpan `pending` dan bisa di-retry (Step 07).
- Komunikasi antar service pakai header `x-internal-key` (shared secret di `.env`).

### 5. Struktur Folder Akhir

```
absensi/
├── package.json              # root: script dev menjalankan 2 server
├── .env.example
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── config/db.ts
│       ├── common/ (guards, decorators, filters)
│       ├── modules/
│       │   ├── auth/ (auth.module.ts, auth.controller.ts, auth.service.ts)
│       │   ├── users/ (users.module.ts, users.controller.ts, users.service.ts)
│       │   ├── lokasi/ (lokasi.module.ts, lokasi.controller.ts, lokasi.service.ts)
│       │   ├── absensi/ (absensi.module.ts, absensi.controller.ts, absensi.service.ts)
│       │   └── laporan/ (laporan.module.ts, laporan.controller.ts, laporan.service.ts)
│       └── utils/response.ts
├── face-detector/
│   ├── requirements.txt
│   ├── main.py
│   ├── face.py
│   └── location.py
└── uploads/
```

## B. Rencana Sprint

| Sprint | Fokus | Step | Dependensi |
|---|---|---|---|
| Sprint 0 | Fondasi | 01, 02 | Siapa saja boleh mengerjakan. Tidak ada dependensi. |
| Sprint 1 | Auth, Akun & Lokasi | 03, 04, 05 | Butuh Sprint 0 selesai. |
| Sprint 2 | Face Detector (Python) | 06 | Mandiri: hanya butuh Step 01. Boleh dikerjakan PARALEL dengan Sprint 1. |
| Sprint 3 | Integrasi Absensi | 07 | Butuh Sprint 1 dan Sprint 2 selesai. |
| Sprint 4 | Recap, Laporan & Release | 08, 09 | Butuh Sprint 3 selesai. |

```
Sprint 0 ──> Sprint 1 ──┐
    │                   ├──> Sprint 3 ──> Sprint 4
    └────> Sprint 2 ────┘
```

## C. Detail Sprint

## Sprint 0 — Fondasi

**Tujuan:** Project berjalan di 2 port (backend TS + face detector Python) dan database siap.  
**Dependensi:** Siapa saja boleh mengerjakan. Tidak ada dependensi.

### Step 01 — Setup Project

Tujuan: kerangka project, backend (TS) di port 3000 dan face detector (Python) di port 5000, **hidup bersamaan dengan 1 perintah**.

#### 1. Folder

```
absensi/
├── backend/
├── face-detector/
├── uploads/
├── package.json
└── .env.example
```

#### 2. Root `package.json`

```json
{
  "name": "absensi",
  "private": true,
  "scripts": {
    "dev": "concurrently -n BACKEND,FACE -c blue,green \"npm run dev:backend\" \"npm run dev:face\"",
    "dev:backend": "npm --prefix backend run dev",
    "dev:face": "cd face-detector && python -m uvicorn main:app --reload --port 5000",
    "start": "concurrently -n BACKEND,FACE \"npm --prefix backend run start\" \"cd face-detector && python -m uvicorn main:app --port 5000\"",
    "install:all": "npm install && npm --prefix backend install && pip install -r face-detector/requirements.txt"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

Jalankan semua: `npm run dev` → 2 port langsung hidup.

#### 3. Backend (NestJS)

Dependencies:
```
npm i @nestjs/common @nestjs/core @nestjs/platform-express reflect-metadata rxjs pg jsonwebtoken bcryptjs multer dotenv axios form-data
npm i -D typescript ts-node @types/node @types/pg @types/jsonwebtoken @types/bcryptjs @types/multer
```

`backend/package.json` scripts:
```json
{
  "scripts": {
    "dev": "ts-node src/main.ts",
    "build": "tsc",
    "start": "node dist/main.js",
    "migrate": "ts-node src/config/migrate.ts"
  }
}
```

`backend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "commonjs",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

`backend/src/main.ts` (minimal):
```ts
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const port = Number(process.env.BACKEND_PORT) || 3000;
  await app.listen(port);
  console.log(`Backend jalan di :${port}`);
}
bootstrap();
```

#### 4. Face Detector (kerangka)

`face-detector/main.py`:
```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"service": "face-detector", "ok": True}
```

`face-detector/requirements.txt`:
```
fastapi
uvicorn[standard]
python-multipart
face_recognition
numpy
requests
python-dotenv
```

> `face_recognition` butuh `dlib` (perlu cmake + compiler). Jika gagal install di Windows, pakai alternatif `deepface`, tapi API `/verify` harus tetap sama (lihat Step 06).

#### 5. `.env.example`

```
BACKEND_PORT=3000
FACE_PORT=5000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=absensi
DB_USER=postgres
DB_PASSWORD=postgres

JWT_SECRET=ganti_ini
JWT_EXPIRES=1d

FACE_URL=http://localhost:5000
BACKEND_URL=http://localhost:3000
INTERNAL_KEY=ganti_rahasia_internal

FACE_THRESHOLD=0.5
```

#### 6. Selesai jika

- [ ] `npm run install:all` sukses
- [ ] `npm run dev` menyalakan 2 server
- [ ] `GET http://localhost:3000/health` → `ok: true`
- [ ] `GET http://localhost:5000/health` → `ok: true`
- [ ] Edit file `.ts` → backend restart otomatis

### Step 02 — Database PostgreSQL

Tujuan: koneksi `pg`, skema tabel, seed akun awal.

#### 1. Koneksi — `backend/src/config/db.ts`

```ts
import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

export const db = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
```

#### 2. Skema — `backend/sql/schema.sql`

```sql
CREATE TYPE role_enum AS ENUM ('admin_sdm', 'admin_outsourcing', 'koordinator', 'user');
CREATE TYPE absen_tipe AS ENUM ('masuk', 'pulang');
CREATE TYPE absen_status AS ENUM ('pending', 'berhasil', 'gagal');

CREATE TABLE lokasi_kerja (
  id SERIAL PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_meter INT NOT NULL DEFAULT 100,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role role_enum NOT NULL,
  no_hp VARCHAR(20),
  foto_wajah TEXT,                       -- path foto referensi
  lokasi_id INT REFERENCES lokasi_kerja(id),
  dibuat_oleh INT REFERENCES users(id),  -- siapa yang membuat akun
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE absensi (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  tipe absen_tipe NOT NULL DEFAULT 'masuk',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  foto_absen TEXT NOT NULL,
  status absen_status NOT NULL DEFAULT 'pending',
  face_valid BOOLEAN,
  lokasi_valid BOOLEAN,
  face_score DOUBLE PRECISION,           -- jarak/skor kecocokan wajah
  jarak_meter DOUBLE PRECISION,          -- jarak ke lokasi kerja
  alasan TEXT,                           -- alasan gagal
  created_at TIMESTAMP DEFAULT NOW(),
  validated_at TIMESTAMP
);

CREATE INDEX idx_absensi_user_tgl ON absensi(user_id, created_at);
CREATE INDEX idx_absensi_status ON absensi(status);
```

#### 3. Script migrate & seed — `backend/src/config/migrate.ts`

Fungsi: baca `sql/schema.sql` lalu jalankan; seed 1 akun `admin_sdm` (username `adminsdm`, password `admin123`, hash dengan bcryptjs) dan 1 lokasi contoh.

Tambah script di `backend/package.json`:
```json
"migrate": "ts-node src/config/migrate.ts"
```

Catatan: buat database `absensi` manual dulu (`CREATE DATABASE absensi;`). Script migrate harus aman dijalankan ulang (cek tabel sudah ada, jangan crash).

#### 4. Selesai jika

- [ ] `npm --prefix backend run migrate` sukses
- [ ] 3 tabel ada: `users`, `lokasi_kerja`, `absensi`
- [ ] Akun `adminsdm` ada di tabel `users`

**Definition of Done sprint:** semua checklist "Selesai jika" di atas tercentang, lalu centang sprint ini di bagian D.

---

## Sprint 1 — Auth, Akun & Lokasi

**Tujuan:** Login, manajemen akun sesuai role, dan master lokasi kerja berfungsi.  
**Dependensi:** Butuh Sprint 0 selesai.

### Step 03 — Auth (Login, JWT, Role)

Use case: **LOGIN** (di-include semua aktor).

#### 1. Helper response — `src/utils/response.ts`

```ts
export const ok = (data: any = null, message = "OK") => ({ success: true, message, data });
export const fail = (message: string, code = 400) => ({ success: false, message, data: null });
```

#### 2. Endpoint

| Method | Path | Body | Keterangan |
|---|---|---|---|
| POST | `/api/auth/login` | `{ username, password }` | Return `{ token, user }` |
| GET | `/api/auth/me` | - | Data user dari token |

Aturan:
- Cek `is_active = true`.
- Bandingkan password dengan `bcryptjs.compare`.
- JWT payload: `{ id, role }`, expire dari `.env`.
- Jangan pernah kirim `password_hash` ke response.

#### 3. Guard & Decorator (NestJS)

`src/common/guards/auth.guard.ts`
- Ambil header `Authorization: Bearer <token>`, verifikasi JWT, pasang ke `req.user`. Gagal → 401 UnauthorizedException.

`src/common/guards/roles.guard.ts` & `src/common/decorators/roles.decorator.ts`
- Cek `req.user.role` dengan role yang diizinkan lewat `@Roles(...)`. Gagal → 403 ForbiddenException.

#### 4. Struktur file

```
src/modules/auth/
├── auth.module.ts
├── auth.controller.ts
└── auth.service.ts
```

Daftarkan `AuthModule` di `app.module.ts`.

#### 5. Selesai jika

- [ ] Login `adminsdm/admin123` mengembalikan token
- [ ] Password salah → 401
- [ ] `/api/auth/me` tanpa token → 401
- [ ] `/api/auth/me` dengan token → data user

### Step 04 — Manajemen Akun & Profile

Use case: membuat akun admin mitra, koordinator, user; mengedit akun user; mengedit profile.

#### 1. Aturan siapa boleh membuat siapa

| Pembuat | Boleh membuat role |
|---|---|
| `admin_sdm` | `admin_outsourcing` |
| `admin_outsourcing` | `koordinator`, `user` |
| `koordinator` | `user` |
| `user` | tidak boleh |

Implementasi: buat fungsi kecil di service
```ts
const bolehBuat: Record<string, string[]> = {
  admin_sdm: ["admin_outsourcing"],
  admin_outsourcing: ["koordinator", "user"],
  koordinator: ["user"],
  user: [],
};
```
Jika `roleBaru` tidak ada di daftar → 403.

#### 2. Endpoint

| Method | Path | Role | Keterangan |
|---|---|---|---|
| POST | `/api/users` | admin_sdm, admin_outsourcing, koordinator | Buat akun (cek aturan di atas). Field: nama, username, password, role, no_hp, lokasi_id. Isi `dibuat_oleh` dari token |
| GET | `/api/users` | admin_outsourcing, koordinator | List user. Query: `role`, `search`, `page`, `limit` |
| GET | `/api/users/:id` | admin_outsourcing, koordinator | Detail |
| PUT | `/api/users/:id` | admin_outsourcing, koordinator | Edit akun user (nama, no_hp, lokasi_id, is_active, reset password opsional) |
| POST | `/api/users/:id/foto-wajah` | admin_outsourcing, koordinator | Upload foto referensi wajah (multipart, field `foto`) |
| GET | `/api/profile` | semua | Profile sendiri |
| PUT | `/api/profile` | semua | Edit profile sendiri: nama, no_hp, password (wajib kirim `password_lama`) |

Aturan edit akun user:
- Admin/koordinator hanya boleh mengedit akun dengan role `user`.
- Tidak boleh mengubah `role` lewat endpoint ini.
- Username tidak boleh duplikat → 409.

#### 3. Upload — `src/middleware/upload.ts`

- `multer` disk storage ke `../uploads/wajah/` dan `../uploads/absen/`.
- Hanya `image/jpeg` dan `image/png`, maksimal 3 MB.
- Nama file: `Date.now() + "-" + random + ext`.

#### 4. Struktur file

```
src/modules/users/
├── users.module.ts
├── users.controller.ts
└── users.service.ts
src/modules/profile/
├── profile.module.ts
└── profile.controller.ts
```

#### 5. Selesai jika

- [ ] adminsdm membuat admin_outsourcing sukses; membuat `user` → 403
- [ ] admin_outsourcing membuat koordinator & user sukses
- [ ] koordinator membuat koordinator → 403
- [ ] Foto wajah tersimpan, path masuk `users.foto_wajah`
- [ ] user bisa edit profile sendiri, tidak bisa akses `/api/users`

### Step 05 — Master Lokasi Kerja

Dipakai untuk **validasi lokasi** (validasi ke-2 di face detector). Setiap user punya `lokasi_id`; saat absen, koordinat user dibandingkan dengan titik lokasi + radius.

#### 1. Endpoint

| Method | Path | Role | Keterangan |
|---|---|---|---|
| POST | `/api/lokasi` | admin_outsourcing | Body: `nama`, `latitude`, `longitude`, `radius_meter` |
| GET | `/api/lokasi` | admin_outsourcing, koordinator | List |
| PUT | `/api/lokasi/:id` | admin_outsourcing | Edit |
| DELETE | `/api/lokasi/:id` | admin_outsourcing | Hapus, tolak (409) jika masih dipakai user |

#### 2. Validasi input

- `latitude` -90 s/d 90, `longitude` -180 s/d 180.
- `radius_meter` 10 s/d 5000.

#### 3. Struktur file

```
src/modules/lokasi/
├── lokasi.module.ts
├── lokasi.controller.ts
└── lokasi.service.ts
```

#### 4. Selesai jika

- [ ] CRUD lokasi jalan
- [ ] Koordinat di luar rentang ditolak
- [ ] User bisa di-assign lokasi lewat `PUT /api/users/:id` (`lokasi_id`)

**Definition of Done sprint:** semua checklist "Selesai jika" di atas tercentang, lalu centang sprint ini di bagian D.

---

## Sprint 2 — Face Detector (Python)

**Tujuan:** Service verifikasi wajah + lokasi berjalan mandiri di port 5000 dan bisa dites tanpa backend.  
**Dependensi:** Mandiri: hanya butuh Step 01. Boleh dikerjakan PARALEL dengan Sprint 1.

### Step 06 — Face Detector (Python, port 5000)

Service MANDIRI. Tidak akses database. Menerima data dari backend, melakukan **2 validasi**, lalu mengirim hasil ke backend lewat callback.

#### 1. Dua Validasi

1. **Validasi wajah**: foto absen vs foto referensi user (`face_recognition`).
2. **Validasi lokasi**: jarak koordinat user ke titik lokasi kerja (rumus haversine) ≤ radius.

#### 2. Endpoint

##### `GET /health`
`{ "service": "face-detector", "ok": true }`

##### `POST /verify` (multipart/form-data)

Header wajib: `x-internal-key: <INTERNAL_KEY>`

| Field | Tipe | Keterangan |
|---|---|---|
| `absensi_id` | int | ID absensi di backend |
| `foto_absen` | file | Selfie saat absen |
| `foto_referensi` | file | Foto wajah terdaftar |
| `latitude` | float | Posisi user |
| `longitude` | float | Posisi user |
| `lokasi_latitude` | float | Titik lokasi kerja |
| `lokasi_longitude` | float | Titik lokasi kerja |
| `radius_meter` | int | Radius yang diizinkan |

Respon langsung: `{ "accepted": true, "absensi_id": 12 }` (proses jalan di background supaya backend tidak menunggu lama).

##### Callback ke backend

Setelah selesai, detector memanggil:

`POST {BACKEND_URL}/internal/absensi/callback` dengan header `x-internal-key`, body JSON:

```json
{
  "absensi_id": 12,
  "face_valid": true,
  "lokasi_valid": true,
  "face_score": 0.38,
  "jarak_meter": 42.5,
  "alasan": null
}
```

`alasan` diisi jika gagal, contoh: `"Wajah tidak terdeteksi"`, `"Wajah tidak cocok"`, `"Di luar radius lokasi"`.

#### 3. Struktur file

```
face-detector/
├── main.py       # FastAPI, endpoint /verify, background task, callback
├── face.py       # fungsi cek_wajah(path_absen, path_ref, threshold)
├── location.py   # fungsi hitung_jarak(lat1, lon1, lat2, lon2)
└── requirements.txt
```

#### 4. `location.py`

```python
import math

def hitung_jarak(lat1, lon1, lat2, lon2):
    """Haversine, hasil dalam meter."""
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
```

#### 5. `face.py` (acuan)

```python
import face_recognition

def cek_wajah(path_absen, path_ref, threshold=0.5):
    """Return (valid, score, alasan). Score = jarak, makin kecil makin mirip."""
    img_absen = face_recognition.load_image_file(path_absen)
    img_ref = face_recognition.load_image_file(path_ref)

    enc_absen = face_recognition.face_encodings(img_absen)
    enc_ref = face_recognition.face_encodings(img_ref)

    if len(enc_absen) == 0:
        return False, None, "Wajah tidak terdeteksi pada foto absen"
    if len(enc_absen) > 1:
        return False, None, "Terdeteksi lebih dari satu wajah"
    if len(enc_ref) == 0:
        return False, None, "Foto referensi tidak valid"

    score = float(face_recognition.face_distance([enc_ref[0]], enc_absen[0])[0])
    if score > threshold:
        return False, score, "Wajah tidak cocok"
    return True, score, None
```

#### 6. Alur `main.py` (acuan)

1. Cek `x-internal-key`, salah → 401.
2. Simpan 2 file upload ke folder temp.
3. Kembalikan `accepted` segera, jalankan `BackgroundTasks`.
4. Di background: `cek_wajah` lalu `hitung_jarak`; `lokasi_valid = jarak <= radius`.
5. Gabungkan `alasan` (jika dua-duanya gagal, gabung dengan `"; "`).
6. `requests.post` ke callback backend (timeout 10 detik, retry 3x jika gagal koneksi).
7. Hapus file temp (di `finally`).

#### 7. Catatan

- Port dari `.env` (`FACE_PORT`), threshold dari `FACE_THRESHOLD`.
- Jika memakai library lain (`deepface`, dll), kontrak `/verify` dan callback JSON **tidak boleh berubah**.
- Liveness/anti-foto-layar di luar scope awal (catat sebagai pengembangan lanjutan).

#### 8. Selesai jika

- [x] `GET :5000/health` ok
- [x] `/verify` tanpa key → 401
- [x] Tes manual (Postman/curl) dengan foto sama → `face_valid: true`
- [x] Foto orang lain → `Wajah tidak cocok`
- [x] Koordinat jauh → `lokasi_valid: false`
- [x] Callback sampai ke backend (log di Step 07)

**Definition of Done sprint:** semua checklist "Selesai jika" di atas tercentang, lalu centang sprint ini di bagian D.

---

## Sprint 3 — Integrasi Absensi

**Tujuan:** User bisa absen, backend mengirim ke face detector, detector callback, status final tersimpan.  
**Dependensi:** Butuh Sprint 1 dan Sprint 2 selesai.

### Step 07 — Absensi (Backend ⇄ Face Detector)

Use case: **Melakukan Absen** (role `user`).

#### 1. Endpoint

| Method | Path | Role | Keterangan |
|---|---|---|---|
| POST | `/api/absensi` | user | multipart: `foto` (file), `latitude`, `longitude`, `tipe` (`masuk`/`pulang`) |
| GET | `/api/absensi/:id` | user (milik sendiri) | Cek hasil validasi |
| GET | `/api/absensi/saya` | user | Riwayat sendiri. Query: `dari`, `sampai` |
| POST | `/internal/absensi/callback` | internal (key) | Dipanggil face detector |
| POST | `/internal/absensi/retry-pending` | internal (key) | Kirim ulang absensi `pending` |

#### 2. Alur `POST /api/absensi`

1. Validasi input (foto wajib, lat/lng angka valid).
2. Ambil user: harus punya `foto_wajah` dan `lokasi_id`, kalau tidak → 400 dengan pesan jelas.
3. Cek duplikat: user sudah absen `tipe` yang sama hari ini dengan status `berhasil` atau `pending` → 409.
4. Insert ke `absensi` dengan `status = 'pending'`.
5. Kirim ke face detector (fungsi `kirimKeDetector`, lihat bawah).
6. Balas user langsung: `{ absensi_id, status: "pending" }`. Hasil akhir dicek via `GET /api/absensi/:id`.

Jika langkah 5 gagal (detector mati): **jangan hapus absensi**, biarkan `pending`, catat log. Respon tetap sukses dengan pesan "Absensi diterima, menunggu verifikasi".

#### 3. `kirimKeDetector` (acuan)

```ts
import axios from "axios";
import FormData from "form-data";
import fs from "fs";

export async function kirimKeDetector(absen: any, user: any, lokasi: any) {
  const form = new FormData();
  form.append("absensi_id", String(absen.id));
  form.append("foto_absen", fs.createReadStream(absen.foto_absen));
  form.append("foto_referensi", fs.createReadStream(user.foto_wajah));
  form.append("latitude", String(absen.latitude));
  form.append("longitude", String(absen.longitude));
  form.append("lokasi_latitude", String(lokasi.latitude));
  form.append("lokasi_longitude", String(lokasi.longitude));
  form.append("radius_meter", String(lokasi.radius_meter));

  await axios.post(`${process.env.FACE_URL}/verify`, form, {
    headers: { ...form.getHeaders(), "x-internal-key": process.env.INTERNAL_KEY },
    timeout: 10000,
  });
}
```

#### 4. Callback `POST /internal/absensi/callback`

Validasi data di backend:

1. Header `x-internal-key` harus sama dengan `.env`, salah → 401.
2. Body wajib: `absensi_id`, `face_valid` (boolean), `lokasi_valid` (boolean).
3. Absensi harus ada dan statusnya masih `pending` (kalau sudah final → abaikan, balas 200, hindari update ganda).
4. Tentukan status:
   - `face_valid && lokasi_valid` → `berhasil`
   - selain itu → `gagal`, isi `alasan`
5. Update `face_valid`, `lokasi_valid`, `face_score`, `jarak_meter`, `alasan`, `status`, `validated_at = NOW()`.

Catatan: route `/internal/*` dipasang **tanpa** middleware JWT, hanya cek internal key.

#### 5. Retry pending

`POST /internal/absensi/retry-pending`: ambil absensi `pending` yang lebih tua dari 1 menit dan kurang dari 1 hari, kirim ulang ke detector. Boleh dipanggil manual atau lewat `setInterval` 2 menit di `index.ts` (opsional, simple).

#### 6. Struktur file

```
src/modules/absensi/
├── absensi.route.ts
├── absensi.controller.ts
├── absensi.service.ts
├── detector.client.ts     # kirimKeDetector
└── internal.route.ts      # callback + retry
```

#### 7. Selesai jika

- [ ] User absen → status `pending` → beberapa detik kemudian `berhasil`
- [ ] Wajah beda → `gagal`, alasan "Wajah tidak cocok"
- [ ] Lokasi jauh → `gagal`, alasan "Di luar radius lokasi"
- [ ] Face detector dimatikan → absen tetap tersimpan `pending`, backend tidak crash
- [ ] Detector dinyalakan lagi + retry → status final
- [ ] Callback tanpa key → 401; callback kedua pada absensi yang sama diabaikan

**Definition of Done sprint:** semua checklist "Selesai jika" di atas tercentang, lalu centang sprint ini di bagian D.

---

## Sprint 4 — Recap, Laporan & Release

**Tujuan:** Recap, laporan, export CSV, uji end-to-end, dan cek keamanan.  
**Dependensi:** Butuh Sprint 3 selesai.

### Step 08 — Recap Absensi & Laporan

Use case: **Melihat Recap Absensi** (admin_outsourcing, koordinator) dan **Melihat Laporan** (admin_sdm).

#### 1. Endpoint

| Method | Path | Role | Keterangan |
|---|---|---|---|
| GET | `/api/recap` | admin_outsourcing, koordinator | Recap per user. Query: `dari`, `sampai`, `lokasi_id`, `user_id`, `status`, `page`, `limit` |
| GET | `/api/recap/harian` | admin_outsourcing, koordinator | Rekap per tanggal: jumlah hadir, gagal, pending |
| GET | `/api/laporan` | admin_sdm | Ringkasan semua mitra/lokasi: total user, total hadir, persentase kehadiran, jumlah gagal |
| GET | `/api/laporan/export` | admin_sdm | Download CSV (tanpa library tambahan, susun string manual) |

#### 2. Aturan

- Koordinator hanya melihat user di `lokasi_id` yang sama dengan miliknya.
- Default rentang tanggal: bulan berjalan.
- Hasil recap menyertakan: nama, lokasi, tanggal, jam, tipe, status, jarak_meter, alasan.
- Semua query pakai SQL biasa dengan `JOIN users` dan `JOIN lokasi_kerja`, parameterized.

#### 3. Struktur file

```
src/modules/laporan/
├── laporan.route.ts
├── laporan.controller.ts
└── laporan.service.ts
```

#### 4. Selesai jika

- [ ] Recap terfilter sesuai query
- [ ] Koordinator tidak bisa melihat lokasi lain
- [ ] admin_sdm melihat ringkasan semua lokasi
- [ ] Export CSV terbuka di Excel
- [ ] user biasa mengakses `/api/recap` → 403

### Step 09 — Run Bareng & Checklist Test

#### 1. Menjalankan

```bash
cp .env.example .env        # isi sesuai environment
npm run install:all         # sekali saja
npm --prefix backend run migrate
npm run dev                 # backend :3000 + face detector :5000 hidup bersamaan
```

Produksi:
```bash
npm --prefix backend run build
npm run start
```

Output yang diharapkan di terminal:
```
[BACKEND] Backend jalan di :3000
[FACE]    Uvicorn running on http://127.0.0.1:5000
```

Jika salah satu service mati, yang lain tetap jalan (`concurrently` tanpa flag `--kill-others`). Pantau di log berlabel.

#### 2. Skenario Uji End-to-End

| # | Skenario | Hasil yang diharapkan |
|---|---|---|
| 1 | Login adminsdm | Token diterima |
| 2 | adminsdm buat admin_outsourcing | 201 |
| 3 | admin_outsourcing buat lokasi, koordinator, user | 201 |
| 4 | Upload foto wajah user | `foto_wajah` terisi |
| 5 | Login user, absen di dalam radius, wajah benar | `pending` → `berhasil` |
| 6 | Absen di luar radius | `gagal`, alasan lokasi |
| 7 | Absen dengan wajah orang lain | `gagal`, alasan wajah |
| 8 | Absen 2x di hari yang sama (tipe sama) | 409 |
| 9 | Matikan face detector, absen | `pending`, backend tetap hidup |
| 10 | Nyalakan detector, panggil retry-pending | Status final |
| 11 | Koordinator lihat recap | Hanya lokasinya |
| 12 | adminsdm lihat laporan | Ringkasan semua lokasi |
| 13 | Panggil endpoint role lain | 403 |

#### 3. Cek Keamanan Singkat

- [ ] `.env` masuk `.gitignore`
- [ ] Password tidak pernah muncul di response
- [ ] Endpoint `/internal/*` wajib `x-internal-key`
- [ ] Upload dibatasi tipe & ukuran
- [ ] Semua query SQL parameterized
- [ ] `/uploads` tidak diekspos publik tanpa auth

#### 4. Selesai jika

- [ ] 13 skenario lulus
- [ ] Semua checklist di bagian D tercentang

**Definition of Done sprint:** semua checklist "Selesai jika" di atas tercentang, lalu centang sprint ini di bagian D.

---

## D. Progress, Resume & Prompt AI

### Checklist Progress

```md
- [x] Sprint 0 — Fondasi
  - [x] Step 01 — Setup Project
  - [x] Step 02 — Database PostgreSQL
- [x] Sprint 1 — Auth, Akun & Lokasi
  - [x] Step 03 — Auth (Login, JWT, Role)
  - [x] Step 04 — Manajemen Akun & Profile
  - [x] Step 05 — Master Lokasi Kerja
- [x] Sprint 2 — Face Detector (Python)
  - [x] Step 06 — Face Detector (Python, port 5000)
- [ ] Sprint 3 — Integrasi Absensi
  - [ ] Step 07 — Absensi (Backend ⇄ Face Detector)
- [ ] Sprint 4 — Recap, Laporan & Release
  - [ ] Step 08 — Recap Absensi & Laporan
  - [ ] Step 09 — Run Bareng & Checklist Test
```

### Aturan Resume (jika sesi AI putus)

1. Lihat checklist di bagian D, cari step terakhir yang `[x]`.
2. Lanjut ke step berikutnya yang `[ ]`.
3. Setelah selesai tiap step, centang di bagian D dokumen ini dan tulis file yang dibuat.
4. Jangan ubah file dari step yang sudah selesai kecuali ada bug.

### Prompt Siap Pakai untuk AI

```
Baca ABSENSI-SPRINT.md bagian A (Gambaran Umum) dan bagian D (Checklist Progress).
Kerjakan HANYA Step 0X di Sprint Y.
Ikuti gaya pemrograman simple. Setelah selesai, centang step itu di bagian D
dan tampilkan daftar file yang dibuat + cara test-nya.
```
