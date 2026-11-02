import math

def hitung_jarak(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine formula, mengembalikan jarak antara dua koordinat dalam satuan meter."""
    r = 6371000  # radius bumi dalam meter
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
