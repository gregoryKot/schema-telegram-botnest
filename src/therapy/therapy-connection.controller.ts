import {
  BadRequestException,
  Body,
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
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { uid, parseId as parseIdShared } from '../api/request-utils';
import { SubmitTherapistRequestDto } from './therapist-request.dto';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { TherapyRelationsService } from './therapy-relations.service';
import { TherapyClientDataService } from './therapy-client-data.service';
import { TherapistRequestService } from './therapist-request.service';
import { AccountService } from '../bot/account.service';
import {
  JoinTherapyDto,
  VirtualClientDto,
  AddClientDto,
  TherapistViewDto,
} from './dto/connection.dto';
import { RenameClientDto } from './dto/client-data.dto';

interface AuthRequest extends Request {
  telegramUserId: number;
  userRole?: string;
  webUser: { userId: bigint };
}

// uid()/parseId() — единый источник в request-utils (аудит 2026-07, 2в).
// allowNegative: виртуальные (офлайн) клиенты терапевта кодируются
// отрицательным id = -TherapyRelation.id — только в therapy-эндпоинтах.
const parseId = (raw: string): number =>
  parseIdShared(raw, { allowNegative: true });

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
  ) {}

  // ─── Connection ─────────────────────────────────────────────────────────────

  @Post('invite')
  async createInvite(@Req() req: AuthRequest) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    return this.relationsService.createInvite(uid(req));
  }

  @Get('relation')
  async getRelation(@Req() req: AuthRequest) {
    return this.relationsService.getRelation(uid(req));
  }

  @Post('join')
  async join(@Req() req: AuthRequest, @Body() body: JoinTherapyDto) {
    if (!body.code) throw new BadRequestException('code required');
    const ok = await this.relationsService.joinAsClient(uid(req), body.code);
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
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    return this.relationsService.getClients(uid(req));
  }

  @Delete('clients/:clientId')
  async removeClient(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
  ) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    await this.clientDataService.removeClient(uid(req), parseId(clientId));
    return { ok: true };
  }

  @Post('clients/virtual')
  async addVirtualClient(
    @Req() req: AuthRequest,
    @Body() body: VirtualClientDto,
  ) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    if (!body.name?.trim()) throw new BadRequestException('name required');
    return this.relationsService.addVirtualClient(uid(req), body.name);
  }

  @Post('clients/add')
  addClientManually(@Req() req: AuthRequest, @Body() body: AddClientDto) {
    // SECURITY: silently attaching a therapist to a real user's account (and
    // gaining read access to their schema/mode notes, ratings, etc) without
    // the client's consent is unacceptable for a therapy app. Manual add is
    // now restricted to VIRTUAL clients (offline patients, those without
    // Telegram). Real clients must use the invite-code flow (`joinAsClient`).
    throw new ForbiddenException(
      'Manual add of real Telegram users is disabled. Use the invite code flow: ' +
        'generate a code via /api/therapy/invite, share it with the client, ' +
        'they POST /api/therapy/join.',
    );
    // Defensive: silence "unused" lint by referencing args.
    void req;
    void body;
  }

  @Post('rename-client/:clientId')
  async renameClient(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Body() body: RenameClientDto,
  ) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    await this.relationsService.renameClient(
      uid(req),
      parseId(clientId),
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
      'Этот способ отключён. Используй /api/therapy/request — заявку рассмотрит администратор.',
      410,
    );
  }

  // ─── Therapist role request (admin-approved) ────────────────────────────

  @Post('request')
  @Throttle({
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
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    await this.accountService.setTherapistMode(uid(req), body.on);
    return { ok: true };
  }

  // Отказ от роли терапевта — возврат в CLIENT (см. AccountService.resignTherapist).
  @Delete('therapist-role')
  async resignTherapist(@Req() req: AuthRequest) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    await this.accountService.resignTherapist(uid(req));
    return { ok: true };
  }
}
