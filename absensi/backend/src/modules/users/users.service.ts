import {
  Injectable,
  ForbiddenException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { db } from "../../config/db";
import bcrypt from "bcryptjs";

const bolehBuat: Record<string, string[]> = {
  admin_sdm: ["admin_outsourcing"],
  admin_outsourcing: ["koordinator", "user"],
  koordinator: ["user"],
  user: [],
};

@Injectable()
export class UsersService {
  async createUser(creatorRole: string, creatorId: number, data: any) {
    const allowed = bolehBuat[creatorRole] || [];
    if (!allowed.includes(data.role)) {
      throw new ForbiddenException(
        `Role ${creatorRole} tidak boleh membuat ${data.role}`
      );
    }

    const dup = await db.query("SELECT id FROM users WHERE username = $1", [
      data.username,
    ]);
    if (dup.rows.length > 0) {
      throw new ConflictException("Username sudah dipakai");
    }

    const hash = await bcrypt.hash(data.password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (nama, username, password_hash, role, no_hp, lokasi_id, dibuat_oleh)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, nama, username, role, no_hp, lokasi_id, is_active, created_at`,
      [
        data.nama,
        data.username,
        hash,
        data.role,
        data.no_hp || null,
        data.lokasi_id || null,
        creatorId,
      ]
    );
    return rows[0];
  }

  async listUsers(query: any) {
    let sql = `SELECT id, nama, username, role, no_hp, foto_wajah, lokasi_id, is_active, created_at
               FROM users WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (query.role) {
      sql += ` AND role = $${idx++}`;
      params.push(query.role);
    }
    if (query.search) {
      sql += ` AND (nama ILIKE $${idx} OR username ILIKE $${idx})`;
      params.push(`%${query.search}%`);
      idx++;
    }

    sql += ` ORDER BY created_at DESC`;

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    sql += ` LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, (page - 1) * limit);

    const { rows } = await db.query(sql, params);
    return rows;
  }

  async getUserById(id: number) {
    const { rows } = await db.query(
      `SELECT id, nama, username, role, no_hp, foto_wajah, lokasi_id, is_active, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) {
      throw new NotFoundException("User tidak ditemukan");
    }
    return rows[0];
  }

  async updateUser(id: number, data: any) {
    const target = await this.getUserById(id);
    if (target.role !== "user") {
      throw new ForbiddenException("Hanya bisa mengedit akun user");
    }

    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (data.nama !== undefined) {
      fields.push(`nama = $${idx++}`);
      params.push(data.nama);
    }
    if (data.no_hp !== undefined) {
      fields.push(`no_hp = $${idx++}`);
      params.push(data.no_hp);
    }
    if (data.lokasi_id !== undefined) {
      fields.push(`lokasi_id = $${idx++}`);
      params.push(data.lokasi_id);
    }
    if (data.is_active !== undefined) {
      fields.push(`is_active = $${idx++}`);
      params.push(data.is_active);
    }
    if (data.password) {
      const hash = await bcrypt.hash(data.password, 10);
      fields.push(`password_hash = $${idx++}`);
      params.push(hash);
    }

    if (fields.length === 0) {
      throw new BadRequestException("Tidak ada data untuk diupdate");
    }

    fields.push(`updated_at = NOW()`);
    params.push(id);

    const { rows } = await db.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx}
       RETURNING id, nama, username, role, no_hp, lokasi_id, is_active, updated_at`,
      params
    );
    return rows[0];
  }

  async setFotoWajah(userId: number, filePath: string) {
    const { rows } = await db.query(
      "UPDATE users SET foto_wajah = $1, updated_at = NOW() WHERE id = $2 RETURNING id, foto_wajah",
      [filePath, userId]
    );
    if (rows.length === 0) {
      throw new NotFoundException("User tidak ditemukan");
    }
    return rows[0];
  }
}
