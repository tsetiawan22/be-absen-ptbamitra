import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { AuthGuard } from "../../common/guards/auth.guard";
import { CurrentUser } from "../../common/decorators/user.decorator";
import { db } from "../../config/db";
import bcrypt from "bcryptjs";
import { ok } from "../../utils/response";

@Controller("api/profile")
@UseGuards(AuthGuard)
export class ProfileController {
  @Get()
  async getProfile(@CurrentUser() user: any) {
    const { rows } = await db.query(
      "SELECT id, nama, username, role, no_hp, foto_wajah, lokasi_id, created_at FROM users WHERE id = $1",
      [user.id]
    );
    return ok(rows[0]);
  }

  @Put()
  async updateProfile(@CurrentUser() user: any, @Body() body: any) {
    const userId = user.id;
    const { nama, no_hp, password, password_lama } = body;

    if (password) {
      if (!password_lama) {
        throw new BadRequestException("Password lama wajib diisi untuk ganti password");
      }
      const { rows: u } = await db.query(
        "SELECT password_hash FROM users WHERE id = $1",
        [userId]
      );
      const match = await bcrypt.compare(password_lama, u[0].password_hash);
      if (!match) {
        throw new UnauthorizedException("Password lama salah");
      }
    }

    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (nama !== undefined) {
      fields.push(`nama = $${idx++}`);
      params.push(nama);
    }
    if (no_hp !== undefined) {
      fields.push(`no_hp = $${idx++}`);
      params.push(no_hp);
    }
    if (password) {
      fields.push(`password_hash = $${idx++}`);
      params.push(await bcrypt.hash(password, 10));
    }

    if (fields.length === 0) {
      throw new BadRequestException("Tidak ada data untuk diupdate");
    }

    fields.push(`updated_at = NOW()`);
    params.push(userId);

    const { rows } = await db.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx}
       RETURNING id, nama, username, role, no_hp, updated_at`,
      params
    );
    return ok(rows[0], "Profile berhasil diupdate");
  }
}
