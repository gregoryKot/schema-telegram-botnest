import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthOauthController } from './auth-oauth.controller';
import { AuthAccountController } from './auth-account.controller';
import { AuthLinkController } from './auth-link.controller';
import { AuthEmailCodeController } from './auth-email-code.controller';
import { EmailLinkCodeService } from './email-link-code.service';
import { AuthMaxController } from './auth-max.controller';
import { AuthTicketController } from './auth-ticket.controller';
import { AuthTicketHandoffController } from './auth-ticket-handoff.controller';
import { AuthLoginConfirmController } from './auth-login-confirm.controller';
import { LoginTicketService } from './login-ticket/login-ticket.service';
import { LoginTicketReport } from './login-ticket/login-ticket.report';
import { TicketLinkService } from './login-ticket/ticket-link.service';
import { TicketDeviceService } from './login-ticket/ticket-device';
import { Auth2faController } from './auth-2fa.controller';
import { AuthFlowService } from './auth-flow.service';
import { EmailTokenService } from './email-token.service';
import { CallerIdentityService } from './caller-identity';
import { JwtAuthGuard, OptionalJwtGuard } from './jwt.guard';
import { MergeService } from './merge.service';
import { SecurityLogService } from './security-log.service';
import { TotpService } from './totp.service';
import { TotpAttemptsService } from './totp-attempts';
import { SecurityNoticeService } from './security-notice.service';
import { StepUpService } from './step-up';
import { EmailService } from './email.service';
import { AuthProviderRegistry } from './providers/registry';
import { TelegramProvider } from './providers/telegram.provider';
import { VkProvider } from './providers/vk.provider';
import { MaxProvider } from './providers/max.provider';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  // NotificationModule — очередь сообщений бота для SecurityNoticeService.
  imports: [PrismaModule, AnalyticsModule, NotificationModule],
  providers: [
    AuthService,
    AuthFlowService,
    EmailTokenService,
    EmailLinkCodeService,
    CallerIdentityService,
    JwtAuthGuard,
    OptionalJwtGuard,
    MergeService,
    LoginTicketService,
    LoginTicketReport,
    TicketLinkService,
    TicketDeviceService,
    SecurityLogService,
    SecurityNoticeService,
    TotpService,
    TotpAttemptsService,
    StepUpService, // его берёт StepUpGuard в @UseGuards
    EmailService,
    TelegramProvider,
    VkProvider,
    MaxProvider,
    AuthProviderRegistry,
  ],
  controllers: [
    AuthController,
    AuthOauthController,
    AuthAccountController,
    AuthLinkController,
    AuthEmailCodeController,
    AuthMaxController,
    AuthTicketController,
    AuthTicketHandoffController,
    AuthLoginConfirmController,
    Auth2faController,
  ],
  // MaxProvider — отдельно от реестра: его использует TelegramAuthGuard (api/).
  exports: [
    AuthService,
    JwtAuthGuard,
    SecurityLogService,
    EmailService,
    TotpService, // второй фактор перед удалением аккаунта (api/)
    MaxProvider,
    LoginTicketService, // отказ на карточке привязки в боте (TelegramModule)
    TicketLinkService, // подтверждение объединения (telegram.link.service)
  ],
})
export class AuthModule {}
