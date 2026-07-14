import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { uid } from './request-utils';
import { BotService, NEED_IDS } from '../bot/bot.service';
import { PairsService } from '../bot/pairs.service';
import { AccountService } from '../bot/account.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { PairCodeDto } from './dto/pairs.dto';

interface AuthRequest extends Request {
  webUser: { userId: bigint };
}

// Пары (2 юзера сверяют трекеры друг друга) — коды приглашений, join/leave,
// сводка по партнёру для главного экрана.
@Controller('api')
@UseGuards(TelegramAuthGuard)
export class PairsController {
  constructor(
    private readonly pairsService: PairsService,
    private readonly accountService: AccountService,
    private readonly botService: BotService,
    private readonly analyticsService: BotAnalyticsService,
  ) {}

  @Get('pair')
  async getPair(@Req() req: AuthRequest) {
    const pairs = await this.pairsService.getUserPairs(uid(req));
    const activePairs = pairs.filter((p) => p.status === 'active');
    const pendingPair = pairs.find(
      (p) => p.status === 'pending' && p.isCreator,
    );

    const partners = await Promise.all(
      activePairs.map(async (pair) => {
        const [partnerRatings, partnerName, partnerHistory] = await Promise.all(
          [
            this.botService.getRatings(BigInt(pair.partnerId!)),
            this.accountService.getUserFirstName(BigInt(pair.partnerId!)),
            this.analyticsService.getHistoryRatings(BigInt(pair.partnerId!), 7),
          ],
        );
        const partnerRaw =
          NEED_IDS.reduce((s, id) => s + (partnerRatings[id] ?? 0), 0) /
          NEED_IDS.length;
        const partnerTodayDone = NEED_IDS.every(
          (id) => partnerRatings[id] !== undefined,
        );
        const histByDate = new Map(
          partnerHistory.map((d) => [d.date, d.ratings]),
        );
        const partnerWeekAvgs = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setUTCDate(d.getUTCDate() - i);
          const date = d.toISOString().split('T')[0];
          const ratings = histByDate.get(date);
          if (!ratings) return null;
          const done = NEED_IDS.every((id) => ratings[id] !== undefined);
          if (!done) return null;
          const avg =
            NEED_IDS.reduce((s, id) => s + (ratings[id] ?? 0), 0) /
            NEED_IDS.length;
          return Math.round(avg * 10) / 10;
        });
        return {
          code: pair.code,
          partnerIndex: partnerTodayDone
            ? Math.round(partnerRaw * 10) / 10
            : null,
          partnerTodayDone,
          partnerName,
          partnerTelegramId: pair.partnerId,
          partnerWeekAvgs,
        };
      }),
    );

    return { partners, pendingCode: pendingPair?.code ?? null };
  }

  @Post('pair/invite')
  async createPairInvite(@Req() req: AuthRequest) {
    const code = await this.pairsService.createPairInvite(uid(req));
    const url = `https://t.me/SchemaLabBot/diary?startapp=pair_${code}`;
    return { code, url };
  }

  @Post('pair/join')
  async joinPair(@Req() req: AuthRequest, @Body() body: PairCodeDto) {
    if (!body.code || !/^[A-Z0-9]{5,12}$/i.test(body.code))
      throw new BadRequestException('Invalid code format');
    const ok = await this.pairsService.joinPair(
      uid(req),
      body.code.toUpperCase(),
    );
    if (!ok) throw new BadRequestException('Invalid or expired code');
    return { ok: true };
  }

  @Delete('pair')
  async leavePair(@Req() req: AuthRequest, @Body() body: PairCodeDto) {
    if (!body.code) throw new BadRequestException('Code required');
    await this.pairsService.leavePair(uid(req), body.code);
    return { ok: true };
  }
}
