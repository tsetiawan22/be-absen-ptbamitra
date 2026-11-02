import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UsersService } from "./users.service";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/user.decorator";
import { multerWajahOptions } from "../../middleware/upload";
import { ok } from "../../utils/response";

@Controller("api/users")
@UseGuards(AuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles("admin_sdm", "admin_outsourcing", "koordinator")
  async create(@CurrentUser() user: any, @Body() body: any) {
    const data = await this.usersService.createUser(user.role, user.id, body);
    return ok(data, "User berhasil dibuat");
  }

  @Get()
  @Roles("admin_outsourcing", "koordinator")
  async list(@Query() query: any) {
    const data = await this.usersService.listUsers(query);
    return ok(data);
  }

  @Get(":id")
  @Roles("admin_outsourcing", "koordinator")
  async detail(@Param("id") id: string) {
    const data = await this.usersService.getUserById(Number(id));
    return ok(data);
  }

  @Put(":id")
  @Roles("admin_outsourcing", "koordinator")
  async update(@Param("id") id: string, @Body() body: any) {
    const data = await this.usersService.updateUser(Number(id), body);
    return ok(data, "User berhasil diupdate");
  }

  @Post(":id/foto-wajah")
  @Roles("admin_outsourcing", "koordinator")
  @UseInterceptors(FileInterceptor("foto", multerWajahOptions))
  async uploadFoto(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) throw new BadRequestException("File foto wajib diupload");
    const data = await this.usersService.setFotoWajah(Number(id), file.path);
    return ok(data, "Foto wajah berhasil diupload");
  }
}
