import os
import sys
import time
import json
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import requests

# Set environment
os.environ["INTERNAL_KEY"] = "test_internal_key_123"
os.environ["BACKEND_URL"] = "http://localhost:3000"
os.environ["FACE_THRESHOLD"] = "0.5"

captured_callbacks = []

class MockBackendHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/internal/absensi/callback":
            key = self.headers.get("x-internal-key")
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            data = json.loads(body)
            captured_callbacks.append({"key": key, "data": data})
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status": "received"}')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # Nonaktifkan log bising


def run_mock_backend():
    server = HTTPServer(("localhost", 3000), MockBackendHandler)
    server.serve_forever()


if __name__ == "__main__":
    # 1. Jalankan mock backend di thread
    backend_thread = threading.Thread(target=run_mock_backend, daemon=True)
    backend_thread.start()
    print("Mock backend listening on port 3000")

    # 2. Jalankan uvicorn face-detector di thread
    import uvicorn
    from main import app

    config = uvicorn.Config(app, host="127.0.0.1", port=5000, log_level="warning")
    server = uvicorn.Server(config)
    server_thread = threading.Thread(target=server.run, daemon=True)
    server_thread.start()

    time.sleep(2)  # Tunggu server aktif

    BASE_URL = "http://localhost:5000"
    INTERNAL_KEY = "test_internal_key_123"
    IMG_A = "c:/Project_PTBA/absensi/face-detector/test_images/person_a.jpg"
    IMG_B = "c:/Project_PTBA/absensi/face-detector/test_images/person_b.jpg"

    # Test 1: GET /health
    print("\n--- Test 1: GET /health ---")
    res_health = requests.get(f"{BASE_URL}/health")
    print("Health response:", res_health.status_code, res_health.json())
    assert res_health.status_code == 200
    assert res_health.json() == {"service": "face-detector", "ok": True}
    print("[PASS] Test 1 PASSED")

    # Test 2: POST /verify tanpa header x-internal-key
    print("\n--- Test 2: POST /verify tanpa internal key ---")
    with open(IMG_A, "rb") as fa, open(IMG_A, "rb") as fr:
        res_nokey = requests.post(
            f"{BASE_URL}/verify",
            files={"foto_absen": fa, "foto_referensi": fr},
            data={
                "absensi_id": 1,
                "latitude": -3.7258,
                "longitude": 103.7844,
                "lokasi_latitude": -3.7259,
                "lokasi_longitude": 103.7844,
                "radius_meter": 100,
            },
        )
    print("No key response:", res_nokey.status_code)
    assert res_nokey.status_code == 401
    print("[PASS] Test 2 PASSED")

    # Test 3: POST /verify dengan wajah cocok dan lokasi dalam radius
    print("\n--- Test 3: POST /verify Wajah Cocok & Lokasi Valid ---")
    with open(IMG_A, "rb") as fa, open(IMG_A, "rb") as fr:
        res_valid = requests.post(
            f"{BASE_URL}/verify",
            headers={"x-internal-key": INTERNAL_KEY},
            files={"foto_absen": fa, "foto_referensi": fr},
            data={
                "absensi_id": 101,
                "latitude": -3.7258,
                "longitude": 103.7844,
                "lokasi_latitude": -3.7259,
                "lokasi_longitude": 103.7844,
                "radius_meter": 100,
            },
        )
    print("Verify valid response:", res_valid.status_code, res_valid.json())
    assert res_valid.status_code == 200
    assert res_valid.json() == {"accepted": True, "absensi_id": 101}

    # Tunggu callback diproses di background task (maks 10 detik)
    for _ in range(20):
        if len(captured_callbacks) >= 1:
            break
        time.sleep(0.5)

    assert len(captured_callbacks) >= 1, f"Callback tidak diterima: {captured_callbacks}"
    cb1 = captured_callbacks[-1]
    print("Callback 1 received:", cb1)
    assert cb1["key"] == INTERNAL_KEY
    assert cb1["data"]["absensi_id"] == 101
    assert cb1["data"]["face_valid"] is True
    assert cb1["data"]["lokasi_valid"] is True
    assert cb1["data"]["alasan"] is None
    print("[PASS] Test 3 PASSED")

    # Test 4: POST /verify dengan wajah beda dan lokasi jauh (di luar radius)
    print("\n--- Test 4: POST /verify Wajah Beda & Di Luar Radius ---")
    with open(IMG_A, "rb") as fa, open(IMG_B, "rb") as fr:
        res_invalid = requests.post(
            f"{BASE_URL}/verify",
            headers={"x-internal-key": INTERNAL_KEY},
            files={"foto_absen": fa, "foto_referensi": fr},
            data={
                "absensi_id": 102,
                "latitude": -3.7258,
                "longitude": 103.7844,
                "lokasi_latitude": -3.8000,
                "lokasi_longitude": 103.9000,
                "radius_meter": 100,
            },
        )
    print("Verify invalid response:", res_invalid.status_code, res_invalid.json())
    assert res_invalid.status_code == 200
    assert res_invalid.json() == {"accepted": True, "absensi_id": 102}

    for _ in range(20):
        if len(captured_callbacks) >= 2:
            break
        time.sleep(0.5)

    assert len(captured_callbacks) >= 2, f"Callback 2 tidak diterima: {captured_callbacks}"
    cb2 = captured_callbacks[-1]
    print("Callback 2 received:", cb2)
    assert cb2["key"] == INTERNAL_KEY
    assert cb2["data"]["absensi_id"] == 102
    assert cb2["data"]["face_valid"] is False
    assert cb2["data"]["lokasi_valid"] is False
    assert "Wajah tidak cocok" in cb2["data"]["alasan"]
    assert "Di luar radius lokasi" in cb2["data"]["alasan"]
    print("[PASS] Test 4 PASSED")

    print("\n===============================")
    print("ALL TESTS PASSED SUCCESSFULLY!!")
    print("===============================")
    server.should_exit = True
    sys.exit(0)
