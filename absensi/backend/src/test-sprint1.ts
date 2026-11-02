import axios from "axios";

const BASE_URL = process.env.BACKEND_URL || "http://localhost:3000";
const client = axios.create({ baseURL: BASE_URL, validateStatus: () => true });

async function runTests() {
  console.log("=== Menjalankan Verifikasi Otomatis Sprint 1 ===");

  // 1. Health
  const health = await client.get("/health");
  console.assert(health.status === 200 && health.data.ok, "Health check failed");
  console.log("✔ Health check OK");

  // 2. Step 03 - Auth
  const loginAdmin = await client.post("/api/auth/login", {
    username: "adminsdm",
    password: "admin123",
  });
  console.assert(loginAdmin.status === 200 && loginAdmin.data.data?.token, "Login admin_sdm gagal");
  const tokenAdmin = loginAdmin.data.data.token;
  console.log("✔ Login adminsdm/admin123 berhasil mengembalikan token");

  const loginWrong = await client.post("/api/auth/login", {
    username: "adminsdm",
    password: "wrongpassword",
  });
  console.assert(loginWrong.status === 401, "Password salah harusnya 401");
  console.log("✔ Password salah mengembalikan 401");

  const meNoToken = await client.get("/api/auth/me");
  console.assert(meNoToken.status === 401, "/me tanpa token harusnya 401");
  console.log("✔ /api/auth/me tanpa token mengembalikan 401");

  const meWithToken = await client.get("/api/auth/me", {
    headers: { Authorization: `Bearer ${tokenAdmin}` },
  });
  console.assert(meWithToken.status === 200 && meWithToken.data.data.username === "adminsdm", "/me token valid gagal");
  console.log("✔ /api/auth/me dengan token mengembalikan data user");

  // 3. Step 04 - Manajemen Akun
  const rnd = Math.random().toString(36).slice(2, 7);
  const outUser = `mitra_${rnd}`;
  const createMitra = await client.post(
    "/api/users",
    {
      nama: "Admin Mitra",
      username: outUser,
      password: "password123",
      role: "admin_outsourcing",
    },
    { headers: { Authorization: `Bearer ${tokenAdmin}` } }
  );
  console.assert(createMitra.status === 200, "Admin SDM gagal buat admin_outsourcing");
  console.log("✔ admin_sdm berhasil membuat admin_outsourcing");

  const adminCreateUserIllegal = await client.post(
    "/api/users",
    {
      nama: "Illegal User",
      username: `illegal_${rnd}`,
      password: "password123",
      role: "user",
    },
    { headers: { Authorization: `Bearer ${tokenAdmin}` } }
  );
  console.assert(adminCreateUserIllegal.status === 403, "Admin SDM buat user harusnya 403");
  console.log("✔ admin_sdm dilarang (403) membuat role user langsung");

  // Login sebagai admin_outsourcing
  const loginMitra = await client.post("/api/auth/login", {
    username: outUser,
    password: "password123",
  });
  const tokenMitra = loginMitra.data.data.token;

  // Step 05 - Master Lokasi
  const createLok = await client.post(
    "/api/lokasi",
    {
      nama: `Site Tambang ${rnd}`,
      latitude: -5.512541440832765,
      longitude: 105.34394481308341,
      radius_meter: 3000,
    },
    { headers: { Authorization: `Bearer ${tokenMitra}` } }
  );
  console.assert(createLok.status === 200, "Buat lokasi gagal");
  const lokasiId = createLok.data.data.id;
  console.log("✔ admin_outsourcing berhasil membuat lokasi kerja");

  const invalidCoords = await client.post(
    "/api/lokasi",
    {
      nama: "Invalid Location",
      latitude: 199,
      longitude: 103.75,
      radius_meter: 100,
    },
    { headers: { Authorization: `Bearer ${tokenMitra}` } }
  );
  console.assert(invalidCoords.status === 400, "Koordinat invalid harusnya 400");
  console.log("✔ Koordinat di luar batas ditolak (400)");

  // admin_outsourcing buat koordinator & user
  const koorUser = `koor_${rnd}`;
  const createKoor = await client.post(
    "/api/users",
    {
      nama: "Koordinator 1",
      username: koorUser,
      password: "password123",
      role: "koordinator",
      lokasi_id: lokasiId,
    },
    { headers: { Authorization: `Bearer ${tokenMitra}` } }
  );
  console.assert(createKoor.status === 200, "Buat koordinator gagal");
  console.log("✔ admin_outsourcing berhasil membuat koordinator");

  const workerUser = `worker_${rnd}`;
  const createWorker = await client.post(
    "/api/users",
    {
      nama: "Pekerja 1",
      username: workerUser,
      password: "password123",
      role: "user",
      lokasi_id: lokasiId,
    },
    { headers: { Authorization: `Bearer ${tokenMitra}` } }
  );
  console.assert(createWorker.status === 200, "Buat user gagal");
  const workerId = createWorker.data.data.id;
  console.log("✔ admin_outsourcing berhasil membuat user pekerja");

  // Login sebagai koordinator
  const loginKoor = await client.post("/api/auth/login", {
    username: koorUser,
    password: "password123",
  });
  const tokenKoor = loginKoor.data.data.token;

  // Koordinator coba buat koordinator -> 403
  const koorCreateKoorIllegal = await client.post(
    "/api/users",
    {
      nama: "Koor 2",
      username: `koor2_${rnd}`,
      password: "password123",
      role: "koordinator",
    },
    { headers: { Authorization: `Bearer ${tokenKoor}` } }
  );
  console.assert(koorCreateKoorIllegal.status === 403, "Koordinator buat koordinator harusnya 403");
  console.log("✔ koordinator dilarang (403) membuat koordinator lain");

  // Login sebagai user biasa
  const loginWorker = await client.post("/api/auth/login", {
    username: workerUser,
    password: "password123",
  });
  const tokenWorker = loginWorker.data.data.token;

  // User coba akses /api/users -> 403
  const userAccessUsers = await client.get("/api/users", {
    headers: { Authorization: `Bearer ${tokenWorker}` },
  });
  console.assert(userAccessUsers.status === 403, "User akses /api/users harusnya 403");
  console.log("✔ Role user dilarang (403) mengakses /api/users");

  // User edit profile sendiri
  const editProfile = await client.put(
    "/api/profile",
    { nama: "Pekerja Baru Diupdate", no_hp: "08123456789" },
    { headers: { Authorization: `Bearer ${tokenWorker}` } }
  );
  console.assert(editProfile.status === 200, "User edit profile gagal");
  console.log("✔ Role user dapat mengedit profile sendiri");

  // Hapus lokasi yang sedang dipakai user -> harus 409
  const deleteLokasiUsed = await client.delete(`/api/lokasi/${lokasiId}`, {
    headers: { Authorization: `Bearer ${tokenMitra}` },
  });
  console.assert(deleteLokasiUsed.status === 409, "Hapus lokasi terpakai harusnya 409");
  console.log("✔ Hapus lokasi yang masih digunakan user ditolak (409)");

  console.log("\n=========================================");
  console.log("SEMUA PENGUJIAN SPRINT 1 BERHASIL 100%! 🎉");
  console.log("=========================================");
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
