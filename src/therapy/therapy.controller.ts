import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { uid } from '../api/request-utils';
import { parseClientId } from '../api/parse-user-id';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { TherapyClientDataService } from './therapy-client-data.service';
import { AccountService } from '../bot/account.service';

interface AuthRequest extends Request {
  telegramUserId: number;
  userRole?: string;
  webUser: { userId: bigint };
}

// Остаток после распила therapy.controller.ts (642 → доменные контроллеры,
// см. therapy-connection/therapy-tasks/therapy-notes/mode-maps.controller.ts):
// read-only срезы клиентских данных для терапевта, не попавшие в другие
// домены — YSQ-запрос, дневник, заметки по схемам/режимам, общая история.
@Controller('api/therapy')
@UseGuards(TelegramAuthGuard)
export class TherapyController {
  constructor(
    private readonly clientDataService: TherapyClientDataService,
    private readonly accountService: AccountService,
  ) {}

  // Все ручки одинаково: проверяем роль THERAPIST и мапим единственную
  // доменную ошибку доступа ('No active relation') в 403 — раньше это был
  // шестикратный копипаст try/catch с `e: any`.
  private async asTherapist<T>(
    req: AuthRequest,
    work: (therapistId: bigint) => Promise<T>,
  ): Promise<T> {
    const therapistId = uid(req);
    const role = await this.accountService.getUserRole(therapistId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try {
      return await work(therapistId);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'No active relation')
        throw new ForbiddenException('No active relation with this client');
      throw e;
    }
  }

  @Post('request-ysq/:clientId')
  async requestYsq(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
  ) {
    await this.asTherapist(req, (tid) =>
      this.clientDataService.requestYsq(tid, parseClientId(clientId)),
    );
    return { ok: true };
  }

  @Get('client/:clientId/diary')
  getClientDiary(@Req() req: AuthRequest, @Param('clientId') clientId: string) {
    return this.asTherapist(req, (tid) =>
      this.clientDataService.getClientDiaryEntries(
        tid,
        parseClientId(clientId),
      ),
    );
  }

  @Get('client/:clientId/schema-notes')
  getClientSchemaNotes(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
  ) {
    return this.asTherapist(req, (tid) =>
      this.clientDataService.getClientSchemaNotes(tid, parseClientId(clientId)),
    );
  }

  @Get('client/:clientId/mode-notes')
  getClientModeNotes(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
  ) {
    return this.asTherapist(req, (tid) =>
      this.clientDataService.getClientModeNotes(tid, parseClientId(clientId)),
    );
  }

  @Get('client-history/:clientId')
  getClientHistory(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
  ) {
    return this.asTherapist(req, (tid) =>
      this.clientDataService.getClientHistory(tid, parseClientId(clientId)),
    );
  }

  @Get('client-data/:clientId')
  getClientData(@Req() req: AuthRequest, @Param('clientId') clientId: string) {
    return this.asTherapist(req, (tid) =>
      this.clientDataService.getClientData(tid, parseClientId(clientId)),
    );
  }
}
