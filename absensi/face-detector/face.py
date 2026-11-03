import os
import face_recognition

def cek_wajah(path_absen: str, path_ref: str, threshold: float = 0.5):
    """
    Membandingkan foto absen dengan foto referensi.
    Return (valid: bool, score: float | None, alasan: str | None).
    Score = face distance (jarak euclidean feature), makin kecil makin mirip/cocok.
    """
    try:
        if not os.path.exists(path_absen):
            return False, None, "File foto absen tidak ditemukan"
        if not os.path.exists(path_ref):
            return False, None, "File foto referensi tidak ditemukan"

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

        # face_distance menghasilkan float numpy array
        score = float(face_recognition.face_distance([enc_ref[0]], enc_absen[0])[0])
        score = round(score, 4)

        if score > threshold:
            return False, score, "Wajah tidak cocok"

        return True, score, None

    except Exception as e:
        return False, None, f"Error pemrosesan wajah: {str(e)}"

