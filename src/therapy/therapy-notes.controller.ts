import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { uid, parseId as parseIdShared } from '../api/request-utils';
import { parseClientId } from '../api/parse-user-id';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { TherapyNotesService } from './therapy-notes.service';
import { TherapyClientDataService } from './therapy-client-data.service';
import { AccountService } from '../bot/account.service';
import { CreateSessionNoteDto, SessionInfoDto } from './dto/client-data.dto';
import { ConceptSaveDto } from './dto/concept-save.dto';
import { isCalendarDay } from '../utils/calendar-day';
import { normalizeSessionWork } from './session-work';

interface AuthRequest extends Request {
  userRole?: string;
  webUser: { userId: bigint };
}

// id Int-колонок (заметка, задача, карта): за int32 — 400, не 500 (S18).
const parseId = (raw: string): number =>
  parseIdShared(raw, { allowNegative: true, int32: true });

// «Нет активной связи» из сервиса — 403, а не 500.
async function withRelation<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'No active relation')
      throw new ForbiddenException('No active relation with this client');
    throw e;
  }
}

// Заметки сессий терапевта, карта концептуализации случая и служебная
// информация о ходе терапии (даты сессий, дни встреч).
@Controller('api/therapy')
@UseGuards(TelegramAuthGuard)
export class TherapyNotesController {
  constructor(
    private readonly notesService: TherapyNotesService,
    private readonly clientDataService: TherapyClientDataService,
    private readonly accountService: AccountService,
  ) {}

  // ─── Session Notes ───────────────────────────────────────────────────────────

  @Get('notes/:clientId')
  async getNotes(@Req() req: AuthRequest, @Param('clientId') clientId: string) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    const cid = parseClientId(clientId);
    return withRelation(() => this.notesService.getNotes(uid(req), cid));
  }

  @Get('notes/:clientId/work')
  async getSessionWork(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
  ) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    const cid = parseClientId(clientId);
    return withRelation(() => this.notesService.getSessionWork(uid(req), cid));
  }

  @Get('notes/:clientId/one/:noteId')
  async getNote(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Param('noteId') noteId: string,
  ) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    const cid = parseClientId(clientId);
    return withRelation(() =>
      this.notesService.getNote(uid(req), cid, parseId(noteId)),
    );
  }

  @Post('notes/:clientId')
  async createNote(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Body() body: CreateSessionNoteDto,
  ) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    const work = normalizeSessionWork(body.work);
    if (!body.text?.trim() && work.length === 0)
      throw new BadRequestException('text required');
    if (!isCalendarDay(body.date))
      throw new BadRequestException('Invalid date');
    const note = { date: body.date, text: body.text, work };
    return withRelation(async () => {
      const cid = parseClientId(clientId);
      return this.notesService.createNote(uid(req), cid, note);
    });
  }

  @Delete('notes/:noteId')
  async deleteNote(@Req() req: AuthRequest, @Param('noteId') noteId: string) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    await this.notesService.deleteNote(uid(req), parseId(noteId));
    return { ok: true };
  }

  // ─── Case Conceptualization ──────────────────────────────────────────────────

  @Get('conceptualization/:clientId')
  async getConceptualization(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
  ) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    return withRelation(async () => {
      return this.notesService.getConceptualization(
        uid(req),
        parseClientId(clientId),
      );
    });
  }

  @Post('session-info/:clientId')
  async updateSessionInfo(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Body() body: SessionInfoDto,
  ) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    await withRelation(async () => {
      await this.clientDataService.updateSessionInfo(
        uid(req),
        parseClientId(clientId),
        body,
      );
    });
    return { ok: true };
  }

  @Post('conceptualization/:clientId')
  async saveConceptualization(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Body() body: ConceptSaveDto,
  ) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    return withRelation(async () => {
      return this.notesService.saveConceptualization(
        uid(req),
        parseClientId(clientId),
        body,
      );
    });
  }
}
