import os
from fastapi import FastAPI, Header, HTTPException, status
from dotenv import load_dotenv
from location import hitung_jarak

load_dotenv()

app = FastAPI(title="Face Detector Service")

INTERNAL_KEY = os.getenv("INTERNAL_KEY", "ganti_rahasia_internal")


@app.get("/health")
def health():
    return {"service": "face-detector", "ok": True}


@app.post("/verify")
async def verify_absensi(
    x_internal_key: str = Header(None),
):
    """Draft endpoint verifikasi absensi (wajah + geolokasi)."""
    if x_internal_key != INTERNAL_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Header x-internal-key tidak valid",
        )

    # TODO: Implementasi pemrosesan face_recognition & background task
    return {
        "accepted": True,
        "message": "Endpoint verify dalam tahap pengembangan",
    }

