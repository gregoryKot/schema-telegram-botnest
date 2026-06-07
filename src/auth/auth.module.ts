import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
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
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    AuthService,
    JwtAuthGuard,
    OptionalJwtGuard,
    MergeService,
    SecurityLogService,
    TotpService,
    EmailService,
    GoogleProvider,
    TelegramProvider,
    TelegramOidcProvider,
    VkProvider,
    AuthProviderRegistry,
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard, SecurityLogService, EmailService],
})
export class AuthModule {}
