import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from "@nestjs/common";
import { db } from "../../config/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

@Injectable()
export class AuthService {
  async login(username: string, password: string) {
    const { rows } = await db.query(
      "SELECT id, nama, username, password_hash, role, is_active FROM users WHERE username = $1",
      [username]
    );
    if (rows.length === 0) {
      throw new UnauthorizedException("Username atau password salah");
    }

    const user = rows[0];
    if (!user.is_active) {
      throw new UnauthorizedException("Akun tidak aktif");
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      throw new UnauthorizedException("Username atau password salah");
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "ganti_ini",
      { expiresIn: (process.env.JWT_EXPIRES || "1d") as any }
    );

    const { password_hash, ...safeUser } = user;
    return { token, user: safeUser };
  }

  async getMe(userId: number) {
    const { rows } = await db.query(
      "SELECT id, nama, username, role, no_hp, foto_wajah, lokasi_id, is_active, created_at FROM users WHERE id = $1",
      [userId]
    );
    if (rows.length === 0) {
      throw new NotFoundException("User tidak ditemukan");
    }
    return rows[0];
  }
}
