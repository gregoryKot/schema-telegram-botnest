import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { uid } from './request-utils';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { DataExportService } from '../account/data-export.service';

interface AuthRequest extends Request {
  webUser: { userId: bigint };
}

// Право на переносимость данных (152-ФЗ ст.14 / GDPR art.15,20). Контур и
// решения о составе — src/account/export-policy.ts. Пока без кнопки ни на
// одной площадке (правило №16 CLAUDE.md: честный долг в
// scripts/feature-parity-baseline.json, UI — отдельным PR).
@Controller('api/account')
@UseGuards(TelegramAuthGuard)
export class AccountExportController {
  constructor(private readonly dataExport: DataExportService) {}

  // Экспорт — тяжёлая операция (пара десятков findMany + расшифровка каждой
  // строки), поэтому лимит ощутимо строже обычных ручек (auth-эндпоинты
  // допускают 3-5/мин): раз в минуту, не больше 5 раз в сутки.
  @Get('export')
  @Throttle({
    short: { limit: 1, ttl: 60_000 },
    long: { limit: 5, ttl: 86_400_000 },
  })
  async exportData(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.dataExport.buildExport(uid(req));
    const date = result.exportedAt.slice(0, 10);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="schemehappens-export-${date}.json"`,
    );
    return result;
  }
}
