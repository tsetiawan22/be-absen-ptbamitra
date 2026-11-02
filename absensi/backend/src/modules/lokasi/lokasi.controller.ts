import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from "@nestjs/common";
import { LokasiService } from "./lokasi.service";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ok } from "../../utils/response";

@Controller("api/lokasi")
@UseGuards(AuthGuard, RolesGuard)
export class LokasiController {
  constructor(private readonly lokasiService: LokasiService) {}

  @Post()
  @Roles("admin_outsourcing")
  async create(@Body() body: any) {
    const data = await this.lokasiService.createLokasi(body);
    return ok(data, "Lokasi berhasil dibuat");
  }

  @Get()
  @Roles("admin_outsourcing", "koordinator")
  async list() {
    const data = await this.lokasiService.listLokasi();
    return ok(data);
  }

  @Put(":id")
  @Roles("admin_outsourcing")
  async update(@Param("id") id: string, @Body() body: any) {
    const data = await this.lokasiService.updateLokasi(Number(id), body);
    return ok(data, "Lokasi berhasil diupdate");
  }

  @Delete(":id")
  @Roles("admin_outsourcing")
  async remove(@Param("id") id: string) {
    await this.lokasiService.deleteLokasi(Number(id));
    return ok(null, "Lokasi berhasil dihapus");
  }
}
