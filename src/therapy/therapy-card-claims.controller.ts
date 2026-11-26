import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { type AuthRequest, uid } from '../api/request-utils';
import { parseClientId } from '../api/parse-user-id';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { AccountService } from '../bot/account.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { ResolveCardClaimDto } from './dto/card-claim.dto';
import { PersistentThrottleLimit } from '../api/persistent-throttle-limit';
import {
  listCardClaims,
  resolveCardClaim,
  trackCardClaim,
} from './therapy-invite-card-claim';

// Сверка «Это тот же человек?» в кабинете (аудит 2026-11, S8): код
// приглашения из офлайн-карточки ввёл аккаунт — данные карточки переезжают на
// него только после ответа терапевта. Логика — therapy-invite-card-claim.ts;
// отдельный контроллер — therapy-invites.controller.ts и TherapyInviteService
// заморожены храповиком размера (правило №10). Все where — по therapistId из
// гарда: чужая сверка для этого терапевта не существует (404).
@Controller('api/therapy')
@UseGuards(TelegramAuthGuard)
export class TherapyCardClaimsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly accountService: AccountService,
  ) {}

  private async assertTherapist(req: AuthRequest): Promise<void> {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
  }

  @Get('card-claims')
  async list(@Req() req: AuthRequest) {
    await this.assertTherapist(req);
    return listCardClaims(this.prisma, uid(req));
  }

  // Решение переносит записи карточки на аккаунт — лимит в Postgres (№5),
  // живому психологу его не достичь.
  @Post('card-claims/:clientId')
  @PersistentThrottleLimit({
    short: { limit: 20, ttl: 60_000 },
    long: { limit: 200, ttl: 24 * 3_600_000 },
  })
  async resolve(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Body() body: ResolveCardClaimDto,
  ) {
    await this.assertTherapist(req);
    const therapistId = uid(req);
    const ok = await resolveCardClaim(
      this.prisma,
      therapistId,
      parseClientId(clientId),
      body.cardId,
      body.accept,
    );
    if (!ok) throw new NotFoundException('Card claim not found');
    await trackCardClaim(this.analytics, therapistId, body.accept);
    return { ok: true };
  }
}
