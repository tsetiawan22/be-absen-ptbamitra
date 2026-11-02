import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { db } from "../../config/db";

@Injectable()
export class LokasiService {
  async createLokasi(data: any) {
    this.validate(data);
    const { rows } = await db.query(
      `INSERT INTO lokasi_kerja (nama, latitude, longitude, radius_meter)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.nama, data.latitude, data.longitude, data.radius_meter || 100]
    );
    return rows[0];
  }

  async listLokasi() {
    const { rows } = await db.query("SELECT * FROM lokasi_kerja ORDER BY id");
    return rows;
  }

  async updateLokasi(id: number, data: any) {
    this.validate(data);
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (data.nama !== undefined) {
      fields.push(`nama = $${idx++}`);
      params.push(data.nama);
    }
    if (data.latitude !== undefined) {
      fields.push(`latitude = $${idx++}`);
      params.push(data.latitude);
    }
    if (data.longitude !== undefined) {
      fields.push(`longitude = $${idx++}`);
      params.push(data.longitude);
    }
    if (data.radius_meter !== undefined) {
      fields.push(`radius_meter = $${idx++}`);
      params.push(data.radius_meter);
    }

    if (fields.length === 0) {
      throw new BadRequestException("Tidak ada data untuk diupdate");
    }

    params.push(id);
    const { rows } = await db.query(
      `UPDATE lokasi_kerja SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      params
    );
    if (rows.length === 0) {
      throw new NotFoundException("Lokasi tidak ditemukan");
    }
    return rows[0];
  }

  async deleteLokasi(id: number) {
    const used = await db.query(
      "SELECT id FROM users WHERE lokasi_id = $1 LIMIT 1",
      [id]
    );
    if (used.rows.length > 0) {
      throw new ConflictException(
        "Lokasi masih dipakai user, tidak bisa dihapus"
      );
    }

    const { rowCount } = await db.query(
      "DELETE FROM lokasi_kerja WHERE id = $1",
      [id]
    );
    if (rowCount === 0) {
      throw new NotFoundException("Lokasi tidak ditemukan");
    }
  }

  private validate(data: any) {
    if (data.latitude !== undefined) {
      const lat = Number(data.latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        throw new BadRequestException("Latitude harus antara -90 dan 90");
      }
    }
    if (data.longitude !== undefined) {
      const lng = Number(data.longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        throw new BadRequestException("Longitude harus antara -180 dan 180");
      }
    }
    if (data.radius_meter !== undefined) {
      const r = Number(data.radius_meter);
      if (isNaN(r) || r < 10 || r > 5000) {
        throw new BadRequestException("Radius harus antara 10 dan 5000 meter");
      }
    }
  }
}
