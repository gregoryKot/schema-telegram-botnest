import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PersistentThrottleLimit } from '../api/persistent-throttle-limit';
import { type AuthRequest, uid } from '../api/request-utils';
import { parseClientId } from '../api/parse-user-id';
import { SubmitTherapistRequestDto } from './therapist-request.dto';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { TherapyRelationsService } from './therapy-relations.service';
import { ALREADY_CONNECTED_ERROR } from './therapy-invite';
import { TherapyClientDataService } from './therapy-client-data.service';
import { TherapistRequestService } from './therapist-request.service';
import { AccountService } from '../bot/account.service';
import { TherapistExitService } from './therapist-exit.service';
import { JoinTherapyDto, TherapistViewDto } from './dto/connection.dto';
import { VirtualClientDto } from './dto/virtual-client.dto';
import { RenameClientDto } from './dto/client-data.dto';

// Подключение клиент↔терапевт: инвайт-коды, join/disconnect, список
// клиентов (add/virtual/rename/remove) и заявка на роль терапевта.
@Controller('api/therapy')
@UseGuards(TelegramAuthGuard)
export class TherapyConnectionController {
  constructor(
    private readonly relationsService: TherapyRelationsService,
    private readonly clientDataService: TherapyClientDataService,
    private readonly accountService: AccountService,
    private readonly therapistRequestService: TherapistRequestService,
    private readonly exit: TherapistExitService,
  ) {}

  private async assertTherapist(req: AuthRequest): Promise<void> {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
  }

  // ─── Connection ─────────────────────────────────────────────────────────────

  @Post('invite')
  async createInvite(@Req() req: AuthRequest) {
    await this.assertTherapist(req);
    return this.relationsService.createInvite(uid(req));
  }

  @Get('relation')
  async getRelation(@Req() req: AuthRequest) {
    return this.relationsService.getRelation(uid(req));
  }

  // Терапевт отказался от роли — клиенту сообщение вместо «Мой терапевт».
  @Get('former-therapist')
  async getFormerTherapist(@Req() req: AuthRequest) {
    return this.exit.formerTherapist(uid(req));
  }

  @Post('join')
  async join(@Req() req: AuthRequest, @Body() body: JoinTherapyDto) {
    if (!body.code) throw new BadRequestException('code required');
    let ok: boolean;
    try {
      ok = await this.relationsService.joinAsClient(uid(req), body.code);
    } catch (e) {
      // Уже есть активная связь с другим терапевтом (аудит 2026-10, T3): 409 с
      // машиночитаемой причиной — фронт может показать точный текст вместо
      // общего «неверный код». Форма успешного ответа не меняется.
      if (e instanceof Error && e.message === ALREADY_CONNECTED_ERROR)
        throw new ConflictException({
          message: 'Already connected to another therapist',
          reason: 'already_connected',
        });
      throw e;
    }
    if (!ok) throw new BadRequestException('Invalid or expired code');
    return { ok: true };
  }

  @Delete('relation')
  async disconnect(@Req() req: AuthRequest) {
    await this.relationsService.disconnect(uid(req));
    return { ok: true };
  }

  @Get('clients')
  async getClients(@Req() req: AuthRequest) {
    await this.assertTherapist(req);
    return this.relationsService.getClients(uid(req));
  }

  @Delete('clients/:clientId')
  async removeClient(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
  ) {
    await this.assertTherapist(req);
    await this.clientDataService.removeClient(
      uid(req),
      parseClientId(clientId),
    );
    return { ok: true };
  }

  @Post('clients/virtual')
  async addVirtualClient(
    @Req() req: AuthRequest,
    @Body() body: VirtualClientDto,
  ) {
    await this.assertTherapist(req);
    if (!body.name?.trim()) throw new BadRequestException('name required');
    return this.relationsService.addVirtualClient(uid(req), body.name);
  }

  @Post('rename-client/:clientId')
  async renameClient(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Body() body: RenameClientDto,
  ) {
    await this.assertTherapist(req);
    await this.relationsService.renameClient(
      uid(req),
      parseClientId(clientId),
      body.alias,
    );
    return { ok: true };
  }

  // DEPRECATED. Replaced by /api/therapy/request → admin approval flow.
  // Kept returning 410 Gone so any clients still using the old endpoint get
  // a clear error rather than silent failure.
  @Post('become-therapist')
  becomeTherapist() {
    throw new HttpException(
      'Способ отключён. Заявка подаётся в приложении: Настройки → «Я психолог».',
      410,
    );
  }

  // ─── Therapist role request (admin-approved) ────────────────────────────

  @Post('request')
  @PersistentThrottleLimit({
    short: { limit: 2, ttl: 60_000 },
    long: { limit: 5, ttl: 24 * 3_600_000 },
  })
  async submitRequest(
    @Req() req: AuthRequest,
    @Body() body: SubmitTherapistRequestDto,
  ) {
    return this.therapistRequestService.submit(uid(req), body);
  }

  @Get('request')
  async getMyRequest(@Req() req: AuthRequest) {
    const row = await this.therapistRequestService.getMine(uid(req));
    return row ?? null;
  }

  // ─── Therapist view preference / resignation ────────────────────────────

  // Запоминает предпочтение старта (кабинет vs клиент). Только для THERAPIST —
  // иначе клиент поднял бы себе UI терапевта (privilege escalation).
  @Post('therapist-view')
  async setTherapistView(
    @Req() req: AuthRequest,
    @Body() body: TherapistViewDto,
  ) {
    await this.assertTherapist(req);
    await this.accountService.setTherapistMode(uid(req), body.on);
    return { ok: true };
  }

  // Отказ от роли терапевта — возврат в CLIENT (см. TherapistExitService.resign).
  @Delete('therapist-role')
  async resignTherapist(@Req() req: AuthRequest) {
    await this.assertTherapist(req);
    await this.exit.resign(uid(req));
    return { ok: true };
  }
}
