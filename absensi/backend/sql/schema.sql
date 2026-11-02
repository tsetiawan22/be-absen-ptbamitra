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
  foto_wajah TEXT,
  lokasi_id INT REFERENCES lokasi_kerja(id),
  dibuat_oleh INT REFERENCES users(id),
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
  face_score DOUBLE PRECISION,
  jarak_meter DOUBLE PRECISION,
  alasan TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  validated_at TIMESTAMP
);

CREATE INDEX idx_absensi_user_tgl ON absensi(user_id, created_at);
CREATE INDEX idx_absensi_status ON absensi(status);
