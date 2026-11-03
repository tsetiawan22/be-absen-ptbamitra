import os
import sys
import shutil
import tempfile
import time
from typing import Optional
from fastapi import FastAPI, Header, Form, File, UploadFile, BackgroundTasks, HTTPException, status
from dotenv import load_dotenv
import requests

# Pastikan direktori saat ini ada di sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from location import hitung_jarak
from face import cek_wajah

# Load .env (dari folder saat ini atau root absensi)
env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(env_path):
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

INTERNAL_KEY = os.getenv("INTERNAL_KEY", "ganti_rahasia_internal")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")
FACE_THRESHOLD = float(os.getenv("FACE_THRESHOLD", "0.5"))
FACE_PORT = int(os.getenv("FACE_PORT", "5000"))

app = FastAPI(title="Face Detector Service")


def process_verification(
    absensi_id: int,
    path_absen: str,
    path_ref: str,
    lat: float,
    lon: float,
    lokasi_lat: float,
    lokasi_lon: float,
    radius: int,
):
    """
    Background task:
    1. Validasi wajah (face_recognition)
    2. Validasi lokasi (haversine formula)
    3. Kirim callback ke backend (retry 3x jika gagal koneksi)
    4. Hapus file temporary
    """
    try:
        # 1. Validasi wajah
        face_valid, face_score, face_alasan = cek_wajah(path_absen, path_ref, FACE_THRESHOLD)

        # 2. Validasi lokasi
        jarak_meter = hitung_jarak(lat, lon, lokasi_lat, lokasi_lon)
        jarak_meter = round(jarak_meter, 2)
        lokasi_valid = jarak_meter <= radius

        # 3. Gabungkan alasan jika tidak valid
        reasons = []
        if not face_valid and face_alasan:
            reasons.append(face_alasan)
        if not lokasi_valid:
            reasons.append("Di luar radius lokasi")

        alasan = "; ".join(reasons) if len(reasons) > 0 else None

        payload = {
            "absensi_id": absensi_id,
            "face_valid": bool(face_valid),
            "lokasi_valid": bool(lokasi_valid),
            "face_score": face_score,
            "jarak_meter": jarak_meter,
            "alasan": alasan,
        }

        print(f"[FaceDetector] Hasil verifikasi absensi_id={absensi_id}: {payload}")

        # 4. Kirim callback ke backend
        callback_url = f"{BACKEND_URL}/internal/absensi/callback"
        headers = {
            "x-internal-key": INTERNAL_KEY,
            "Content-Type": "application/json",
        }

        for attempt in range(1, 4):
            try:
                res = requests.post(callback_url, json=payload, headers=headers, timeout=10)
                if res.status_code == 200:
                    print(f"[Callback] Berhasil kirim callback absensi_id={absensi_id}")
                    break
                else:
                    print(f"[Callback] Percobaan ke-{attempt} gagal dengan status HTTP {res.status_code}")
            except Exception as e:
                print(f"[Callback] Percobaan ke-{attempt} gagal koneksi: {e}")
            if attempt < 3:
                time.sleep(1)

    finally:
        # Hapus file temporary
        for p in [path_absen, path_ref]:
            try:
                if p and os.path.exists(p):
                    os.remove(p)
            except Exception as e:
                print(f"[Cleanup] Gagal hapus temp file {p}: {e}")


@app.get("/health")
def health():
    return {"service": "face-detector", "ok": True}


@app.post("/verify")
async def verify_absensi(
    background_tasks: BackgroundTasks,
    x_internal_key: Optional[str] = Header(None, alias="x-internal-key"),
    absensi_id: int = Form(...),
    foto_absen: UploadFile = File(...),
    foto_referensi: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    lokasi_latitude: float = Form(...),
    lokasi_longitude: float = Form(...),
    radius_meter: int = Form(...),
):
    """
    Endpoint verifikasi absensi:
    - Autentikasi via header x-internal-key
    - Simpan file ke direktori sementara
    - Eksekusi background task
    - Respon langsung { accepted: true, absensi_id }
    """
    if not x_internal_key or x_internal_key != INTERNAL_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Header x-internal-key tidak valid",
        )

    try:
        suffix_absen = os.path.splitext(foto_absen.filename or "")[1] or ".jpg"
        suffix_ref = os.path.splitext(foto_referensi.filename or "")[1] or ".jpg"

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix_absen) as tmp_absen:
            shutil.copyfileobj(foto_absen.file, tmp_absen)
            temp_absen_path = tmp_absen.name

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix_ref) as tmp_ref:
            shutil.copyfileobj(foto_referensi.file, tmp_ref)
            temp_ref_path = tmp_ref.name
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memproses file upload: {str(e)}",
        )

    # Jalankan verifikasi di background task
    background_tasks.add_task(
        process_verification,
        absensi_id,
        temp_absen_path,
        temp_ref_path,
        latitude,
        longitude,
        lokasi_latitude,
        lokasi_longitude,
        radius_meter,
    )

    return {
        "accepted": True,
        "absensi_id": absensi_id,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=FACE_PORT, reload=True)
