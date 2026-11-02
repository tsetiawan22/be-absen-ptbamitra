import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AppController } from "./app.controller";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { ProfileModule } from "./modules/profile/profile.module";
import { LokasiModule } from "./modules/lokasi/lokasi.module";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";

@Module({
  imports: [AuthModule, UsersModule, ProfileModule, LokasiModule],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
