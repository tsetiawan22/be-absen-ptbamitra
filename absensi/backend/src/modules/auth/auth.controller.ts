import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthGuard } from "../../common/guards/auth.guard";
import { CurrentUser } from "../../common/decorators/user.decorator";
import { ok } from "../../utils/response";

@Controller("api/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: any) {
    const data = await this.authService.login(body.username, body.password);
    return ok(data, "Login berhasil");
  }

  @Get("me")
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: any) {
    const data = await this.authService.getMe(user.id);
    return ok(data);
  }
}
