import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { db } from "./db";

async function migrate() {
  const client = await db.connect();
  try {
    // Cek apakah tabel sudah ada
    const check = await client.query(
      "SELECT to_regclass('public.users') AS exists"
    );
    if (check.rows[0].exists) {
      console.log("Tabel sudah ada, skip schema.");
    } else {
      const sql = fs.readFileSync(
        path.join(__dirname, "../../sql/schema.sql"),
        "utf-8"
      );
      await client.query(sql);
      console.log("Schema berhasil dibuat.");
    }

    // Seed admin_sdm jika belum ada
    const adminCheck = await client.query(
      "SELECT id FROM users WHERE username = $1",
      ["adminsdm"]
    );
    if (adminCheck.rows.length === 0) {
      const hash = await bcrypt.hash("admin123", 10);
      await client.query(
        `INSERT INTO users (nama, username, password_hash, role)
         VALUES ($1, $2, $3, $4)`,
        ["Admin SDM", "adminsdm", hash, "admin_sdm"]
      );
      console.log("Seed admin_sdm berhasil.");
    } else {
      console.log("Admin sudah ada, skip seed.");
    }

    // Seed / update lokasi contoh
    const lokasiCheck = await client.query("SELECT id FROM lokasi_kerja ORDER BY id LIMIT 1");
    if (lokasiCheck.rows.length === 0) {
      await client.query(
        `INSERT INTO lokasi_kerja (nama, latitude, longitude, radius_meter)
         VALUES ($1, $2, $3, $4)`,
        ["Kantor PTBA", -5.512541440832765, 105.34394481308341, 3000]
      );
      console.log("Seed lokasi contoh berhasil (-5.51254, 105.34394, radius 3000m).");
    } else {
      await client.query(
        `UPDATE lokasi_kerja SET latitude = $1, longitude = $2, radius_meter = $3 WHERE id = $4`,
        [-5.512541440832765, 105.34394481308341, 3000, lokasiCheck.rows[0].id]
      );
      console.log("Lokasi terupdate ke koordinat (-5.51254, 105.34394, radius 3000m).");
    }

    console.log("Migrasi selesai.");
  } catch (err) {
    console.error("Migrasi gagal:", err);
    process.exit(1);
  } finally {
    client.release();
    await db.end();
  }
}

migrate();
