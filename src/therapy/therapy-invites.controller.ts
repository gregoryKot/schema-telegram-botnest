import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PersistentThrottleLimit } from '../api/persistent-throttle-limit';
import { type AuthRequest, uid, parseId } from '../api/request-utils';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { AccountService } from '../bot/account.service';
import { TherapyRelationsService } from './therapy-relations.service';
import { JoinTherapyDto } from './dto/connection.dto';

// Приглашения терапевта после выдачи (инцидент 2026-10-26): список живых
// («Ждут подключения» в кабинете), отзыв и предпросмотр для экрана согласия
// клиента. Выдача кода и подключение — therapy-connection.controller.ts
// (POST invite / join): там контроллер на пределе размера (правило №10).
@Controller('api/therapy')
@UseGuards(TelegramAuthGuard)
export class TherapyInvitesController {
  constructor(
    private readonly relationsService: TherapyRelationsService,
    private readonly accountService: AccountService,
  ) {}

  private async assertTherapist(req: AuthRequest): Promise<void> {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
  }

  @Get('invites')
  async list(@Req() req: AuthRequest) {
    await this.assertTherapist(req);
    return this.relationsService.listInvites(uid(req));
  }

  // Без проверки роли: отозвать своё приглашение можно и после отказа от
  // роли — where всё равно ограничен therapistId из гарда.
  @Delete('invites/:id')
  async revoke(@Req() req: AuthRequest, @Param('id') id: string) {
    const ok = await this.relationsService.revokeInvite(
      uid(req),
      parseId(id, { int32: true }),
    );
    if (!ok) throw new NotFoundException('Invite not found');
    return { ok: true };
  }

  // Чей код — до согласия клиента. Ручка проверяет код, поэтому счётчик в
  // Postgres (правило №5); 12 hex-знаков перебором не взять, лимит — от
  // шума и скриптов, живому человеку его не достичь.
  @Post('invite/preview')
  @PersistentThrottleLimit({
    short: { limit: 10, ttl: 60_000 },
    long: { limit: 100, ttl: 24 * 3_600_000 },
  })
  async preview(@Req() req: AuthRequest, @Body() body: JoinTherapyDto) {
    const res = await this.relationsService.previewInvite(uid(req), body.code);
    if (!res) throw new BadRequestException('Invalid or expired code');
    return res;
  }
}
