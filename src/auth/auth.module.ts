import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthOauthController } from './auth-oauth.controller';
import { AuthTelegramController } from './auth-telegram.controller';
import { AuthAccountController } from './auth-account.controller';
import { AuthMaxController } from './auth-max.controller';
import { AuthDeviceLinkController } from './auth-device-link.controller';
import { DeviceLinkService } from './device-link.service';
import { Auth2faController } from './auth-2fa.controller';
import { AuthFlowService } from './auth-flow.service';
import { JwtAuthGuard, OptionalJwtGuard } from './jwt.guard';
import { MergeService } from './merge.service';
import { SecurityLogService } from './security-log.service';
import { TotpService } from './totp.service';
import { EmailService } from './email.service';
import { AuthProviderRegistry } from './providers/registry';
import { GoogleProvider } from './providers/google.provider';
import { TelegramProvider } from './providers/telegram.provider';
import { TelegramOidcProvider } from './providers/telegram-oidc.provider';
import { VkProvider } from './providers/vk.provider';
import { MaxProvider } from './providers/max.provider';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    AuthService,
    AuthFlowService,
    JwtAuthGuard,
    OptionalJwtGuard,
    MergeService,
    DeviceLinkService,
    SecurityLogService,
    TotpService,
    EmailService,
    GoogleProvider,
    TelegramProvider,
    TelegramOidcProvider,
    VkProvider,
    MaxProvider,
    AuthProviderRegistry,
  ],
  controllers: [
    AuthController,
    AuthOauthController,
    AuthTelegramController,
    AuthAccountController,
    AuthMaxController,
    AuthDeviceLinkController,
    Auth2faController,
  ],
  // MaxProvider экспортируется отдельно от реестра: его напрямую использует
  // TelegramAuthGuard (api/init-data-paths.ts) вне этого модуля.
  exports: [
    AuthService,
    JwtAuthGuard,
    SecurityLogService,
    EmailService,
    MaxProvider,
  ],
})
export class AuthModule {}
