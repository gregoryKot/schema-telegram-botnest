import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpException,
  Logger,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { uid, parseId as parseIdShared } from '../api/request-utils';
import { SubmitTherapistRequestDto } from './therapist-request.dto';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { TherapyRelationsService } from './therapy-relations.service';
import { TherapyTasksService } from './therapy-tasks.service';
import { TherapyTasksViewService } from './therapy-tasks-view.service';
import { TherapyNotesService } from './therapy-notes.service';
import { TherapyClientDataService } from './therapy-client-data.service';
import { ModeMapsService } from './mode-maps.service';
import { TherapistRequestService } from './therapist-request.service';
import { BotService } from '../bot/bot.service';
import {
  JoinTherapyDto,
  VirtualClientDto,
  AddClientDto,
} from './dto/connection.dto';
import { CreateTaskDto, CompleteTaskDto } from './dto/tasks.dto';
import {
  RenameClientDto,
  CreateSessionNoteDto,
  SessionInfoDto,
} from './dto/client-data.dto';
import { ConceptualizationDto } from './dto/conceptualization.dto';
import {
  CustomModeDto,
  CreateModeMapDto,
  UpdateModeMapDto,
} from './dto/mode-maps.dto';

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

@Controller('api/therapy')
@UseGuards(TelegramAuthGuard)
export class TherapyController {
  private readonly logger = new Logger(TherapyController.name);

  constructor(
    private readonly relationsService: TherapyRelationsService,
    private readonly tasksService: TherapyTasksService,
    private readonly tasksViewService: TherapyTasksViewService,
    private readonly notesService: TherapyNotesService,
    private readonly clientDataService: TherapyClientDataService,
    private readonly modeMapsService: ModeMapsService,
    private readonly botService: BotService,
    private readonly therapistRequestService: TherapistRequestService,
  ) {}

  // ─── Connection ─────────────────────────────────────────────────────────────

  @Post('invite')
  async createInvite(@Req() req: AuthRequest) {
    const role = await this.botService.getUserRole(uid(req));
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
    const role = await this.botService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    return this.relationsService.getClients(uid(req));
  }

  @Delete('clients/:clientId')
  async removeClient(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
  ) {
    const role = await this.botService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    await this.clientDataService.removeClient(uid(req), parseId(clientId));
    return { ok: true };
  }

  @Post('clients/virtual')
  async addVirtualClient(
    @Req() req: AuthRequest,
    @Body() body: VirtualClientDto,
  ) {
    const role = await this.botService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    if (!body.name?.trim()) throw new BadRequestException('name required');
    return this.relationsService.addVirtualClient(uid(req), body.name);
  }

  @Post('clients/add')
  async addClientManually(@Req() req: AuthRequest, @Body() body: AddClientDto) {
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

  // DEPRECATED. Replaced by /api/therapy/request → admin approval flow.
  // Kept returning 410 Gone so any clients still using the old endpoint get
  // a clear error rather than silent failure.
  @Post('become-therapist')
  async becomeTherapist() {
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

  // ─── Tasks ───────────────────────────────────────────────────────────────────

  @Post('tasks')
  async createTask(@Req() req: AuthRequest, @Body() body: CreateTaskDto) {
    let targetUserId: bigint = uid(req);
    let assignedBy: bigint | undefined;

    if (body.clientId) {
      const role = await this.botService.getUserRole(uid(req));
      if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
      // SECURITY: assert there is an actual therapy relation. Without this
      // any THERAPIST can inject tasks into ANY user's account.
      try {
        await this.relationsService.assertHasClient(uid(req), body.clientId);
      } catch {
        throw new ForbiddenException('No therapy relation with this client');
      }
      targetUserId = BigInt(body.clientId);
      assignedBy = uid(req);
    }

    const task = await this.tasksService.createTask(
      targetUserId,
      body,
      assignedBy,
    );
    if (assignedBy && targetUserId > 0n) {
      // Pass original (plaintext) body so the notification payload is readable
      await this.tasksService.scheduleTaskNotification(targetUserId, {
        text: body.text,
        needId: body.needId ?? null,
        dueDate: body.dueDate ?? null,
      });
    }
    return task;
  }

  @Get('tasks')
  async getTasks(@Req() req: AuthRequest) {
    return this.tasksService.getTasks(uid(req));
  }

  @Get('tasks/history')
  async getTaskHistory(@Req() req: AuthRequest) {
    return this.tasksService.getTaskHistory(uid(req));
  }

  @Get('tasks/all')
  async getAllTasks(@Req() req: AuthRequest) {
    const role = await this.botService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    return this.tasksViewService.getAllTasksForTherapist(uid(req));
  }

  @Get('tasks/client/:clientId')
  async getTasksForClient(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
  ) {
    const role = await this.botService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    const tasks = await this.tasksViewService.getTasksForClient(
      uid(req),
      parseId(clientId),
    );
    if (tasks === null)
      throw new ForbiddenException('No active relation with this client');
    return tasks;
  }

  @Post('tasks/:id/complete')
  async completeTask(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: CompleteTaskDto,
  ) {
    const owned = await this.tasksService.completeTask(
      uid(req),
      parseId(id),
      body.done,
    );
    if (!owned) throw new ForbiddenException('Task not found or not yours');
    return { ok: true };
  }

  // ─── Client data ─────────────────────────────────────────────────────────────

  @Post('rename-client/:clientId')
  async renameClient(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Body() body: RenameClientDto,
  ) {
    const role = await this.botService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    await this.relationsService.renameClient(
      uid(req),
      parseId(clientId),
      body.alias,
    );
    return { ok: true };
  }

  @Post('request-ysq/:clientId')
  async requestYsq(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
  ) {
    const role = await this.botService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try {
      await this.clientDataService.requestYsq(uid(req), parseId(clientId));
    } catch (e: any) {
      if (e?.message === 'No active relation')
        throw new ForbiddenException('No active relation with this client');
      throw e;
    }
    return { ok: true };
  }

  @Get('client/:clientId/diary')
  async getClientDiary(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
  ) {
    const role = await this.botService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try {
      return await this.clientDataService.getClientDiaryEntries(
        uid(req),
        parseId(clientId),
      );
    } catch (e: any) {
      if (e?.message === 'No active relation')
        throw new ForbiddenException('No active relation with this client');
      throw e;
    }
  }

  @Get('client/:clientId/schema-notes')
  async getClientSchemaNotes(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
  ) {
    const role = await this.botService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try {
      return await this.clientDataService.getClientSchemaNotes(
        uid(req),
        parseId(clientId),
      );
    } catch (e: any) {
      if (e?.message === 'No active relation')
        throw new ForbiddenException('No active relation with this client');
      throw e;
    }
  }

  @Get('client/:clientId/mode-notes')
  async getClientModeNotes(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
  ) {
    const role = await this.botService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try {
      return await this.clientDataService.getClientModeNotes(
        uid(req),
        parseId(clientId),
      );
    } catch (e: any) {
      if (e?.message === 'No active relation')
        throw new ForbiddenException('No active relation with this client');
      throw e;
    }
  }

  @Get('client-history/:clientId')
  async getClientHistory(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
  ) {
    const role = await this.botService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try {
      return await this.clientDataService.getClientHistory(
        uid(req),
        parseId(clientId),
      );
    } catch (e: any) {
      if (e?.message === 'No active relation')
        throw new ForbiddenException('No active relation with this client');
      throw e;
    }
  }

  @Get('client-data/:clientId')
  async getClientData(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
  ) {
    const role = await this.botService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try {
      return await this.clientDataService.getClientData(
        uid(req),
        parseId(clientId),
      );
    } catch (e: any) {
      if (e?.message === 'No active relation')
        throw new ForbiddenException('No active relation with this client');
      throw e;
    }
  }

  // ─── Session Notes ───────────────────────────────────────────────────────────

  @Get('notes/:clientId')
  async getNotes(@Req() req: AuthRequest, @Param('clientId') clientId: string) {
    const role = await this.botService.getUserRole(uid(req));
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
    const role = await this.botService.getUserRole(uid(req));
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
    const role = await this.botService.getUserRole(uid(req));
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
    const role = await this.botService.getUserRole(uid(req));
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
    const role = await this.botService.getUserRole(uid(req));
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
    const role = await this.botService.getUserRole(uid(req));
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

  // ─── Therapist Custom Modes ──────────────────────────────────────────────────

  @Get('custom-modes')
  async listCustomModes(@Req() req: AuthRequest) {
    const role = await this.botService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    return this.modeMapsService.listCustomModes(uid(req));
  }

  @Post('custom-modes')
  async createCustomMode(@Req() req: AuthRequest, @Body() body: CustomModeDto) {
    const role = await this.botService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    if (!body.name?.trim()) throw new BadRequestException('name required');
    return this.modeMapsService.createCustomMode(
      uid(req),
      body as { name: string; emoji?: string; nodeType?: string },
    );
  }

  @Delete('custom-modes/:modeId')
  async deleteCustomMode(
    @Req() req: AuthRequest,
    @Param('modeId') modeId: string,
  ) {
    const role = await this.botService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    await this.modeMapsService.deleteCustomMode(uid(req), parseId(modeId));
    return { ok: true };
  }

  // ─── Mode Maps ───────────────────────────────────────────────────────────────

  @Get('mode-maps/:clientId')
  async listModeMaps(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
  ) {
    const role = await this.botService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try {
      return await this.modeMapsService.listModeMaps(
        uid(req),
        parseId(clientId),
      );
    } catch (e: any) {
      if (e?.message === 'No active relation') throw new ForbiddenException();
      throw e;
    }
  }

  @Get('mode-maps/map/:mapId')
  async getModeMap(@Req() req: AuthRequest, @Param('mapId') mapId: string) {
    const role = await this.botService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try {
      return await this.modeMapsService.getModeMap(uid(req), parseId(mapId));
    } catch (e: any) {
      if (e?.message === 'Not found') throw new ForbiddenException();
      throw e;
    }
  }

  @Post('mode-maps/:clientId')
  async createModeMap(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Body() body: CreateModeMapDto,
  ) {
    const role = await this.botService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    const title = (body.title ?? 'Карта режимов').slice(0, 120);
    try {
      return await this.modeMapsService.createModeMap(
        uid(req),
        parseId(clientId),
        title,
        body.kind,
      );
    } catch (e: any) {
      if (e?.message === 'No active relation') throw new ForbiddenException();
      throw e;
    }
  }

  @Patch('mode-maps/map/:mapId')
  async updateModeMap(
    @Req() req: AuthRequest,
    @Param('mapId') mapId: string,
    @Body() body: UpdateModeMapDto,
  ) {
    const role = await this.botService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try {
      return await this.modeMapsService.updateModeMap(
        uid(req),
        parseId(mapId),
        body,
      );
    } catch (e: any) {
      if (e?.message === 'Not found') throw new ForbiddenException();
      throw e;
    }
  }

  @Delete('mode-maps/map/:mapId')
  async deleteModeMap(@Req() req: AuthRequest, @Param('mapId') mapId: string) {
    const role = await this.botService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try {
      await this.modeMapsService.deleteModeMap(uid(req), parseId(mapId));
      return { ok: true };
    } catch (e: any) {
      if (e?.message === 'Not found') throw new ForbiddenException();
      throw e;
    }
  }

  // ─── Client's read-only view (any authed user; only their own maps) ──────────

  @Get('my-mode-maps')
  async listMyModeMaps(@Req() req: AuthRequest) {
    return this.modeMapsService.listMyModeMaps(uid(req));
  }

  @Get('my-mode-maps/:mapId')
  async getMyModeMap(@Req() req: AuthRequest, @Param('mapId') mapId: string) {
    try {
      return await this.modeMapsService.getMyModeMap(uid(req), parseId(mapId));
    } catch (e: any) {
      if (e?.message === 'Not found') throw new ForbiddenException();
      throw e;
    }
  }
}
