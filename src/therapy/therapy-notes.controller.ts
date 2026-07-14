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
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { TherapyNotesService } from './therapy-notes.service';
import { TherapyClientDataService } from './therapy-client-data.service';
import { AccountService } from '../bot/account.service';
import { CreateSessionNoteDto, SessionInfoDto } from './dto/client-data.dto';
import { ConceptualizationDto } from './dto/conceptualization.dto';

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
    try {
      return await this.notesService.getNotes(uid(req), parseId(clientId));
    } catch (e: any) {
      if (e?.message === 'No active relation')
        throw new ForbiddenException('No active relation with this client');
      throw e;
    }
  }

  @Post('notes/:clientId')
  async createNote(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Body() body: CreateSessionNoteDto,
  ) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    if (!body.text?.trim()) throw new BadRequestException('text required');
    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date))
      throw new BadRequestException('Invalid date');
    const note = { date: body.date, text: body.text.slice(0, 5000) };
    try {
      return await this.notesService.createNote(
        uid(req),
        parseId(clientId),
        note,
      );
    } catch (e: any) {
      if (e?.message === 'No active relation')
        throw new ForbiddenException('No active relation with this client');
      throw e;
    }
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
    try {
      return await this.notesService.getConceptualization(
        uid(req),
        parseId(clientId),
      );
    } catch (e: any) {
      if (e?.message === 'No active relation')
        throw new ForbiddenException('No active relation with this client');
      throw e;
    }
  }

  @Post('session-info/:clientId')
  async updateSessionInfo(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Body() body: SessionInfoDto,
  ) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try {
      await this.clientDataService.updateSessionInfo(
        uid(req),
        parseId(clientId),
        body,
      );
    } catch (e: any) {
      if (e?.message === 'No active relation')
        throw new ForbiddenException('No active relation with this client');
      throw e;
    }
    return { ok: true };
  }

  @Post('conceptualization/:clientId')
  async saveConceptualization(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Body() body: ConceptualizationDto,
  ) {
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try {
      return await this.notesService.saveConceptualization(
        uid(req),
        parseId(clientId),
        body,
      );
    } catch (e: any) {
      if (e?.message === 'No active relation')
        throw new ForbiddenException('No active relation with this client');
      throw e;
    }
  }
}
