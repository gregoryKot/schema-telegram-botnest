import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpException, Logger, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { TherapyService } from './therapy.service';
import { TherapistRequestService } from './therapist-request.service';
import { BotService } from '../bot/bot.service';

interface AuthRequest extends Request {
  telegramUserId: number;
  userRole?: string;
}

function parseId(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n === 0) throw new BadRequestException('Invalid id');
  return n;
}

@Controller('api/therapy')
@UseGuards(TelegramAuthGuard)
export class TherapyController {
  private readonly logger = new Logger(TherapyController.name);

  constructor(
    private readonly therapyService: TherapyService,
    private readonly botService: BotService,
    private readonly therapistRequestService: TherapistRequestService,
  ) {}

  // ─── Connection ─────────────────────────────────────────────────────────────

  @Post('invite')
  async createInvite(@Req() req: AuthRequest) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    return this.therapyService.createInvite(req.telegramUserId);
  }

  @Get('relation')
  async getRelation(@Req() req: AuthRequest) {
    return this.therapyService.getRelation(req.telegramUserId);
  }

  @Post('join')
  async join(@Req() req: AuthRequest, @Body() body: { code: string }) {
    if (!body.code) throw new BadRequestException('code required');
    const ok = await this.therapyService.joinAsClient(req.telegramUserId, body.code);
    if (!ok) throw new BadRequestException('Invalid or expired code');
    return { ok: true };
  }

  @Delete('relation')
  async disconnect(@Req() req: AuthRequest) {
    await this.therapyService.disconnect(req.telegramUserId);
    return { ok: true };
  }

  @Get('clients')
  async getClients(@Req() req: AuthRequest) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    return this.therapyService.getClients(req.telegramUserId);
  }

  @Delete('clients/:clientId')
  async removeClient(@Req() req: AuthRequest, @Param('clientId') clientId: string) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    await this.therapyService.removeClient(req.telegramUserId, parseId(clientId));
    return { ok: true };
  }

  @Post('clients/virtual')
  async addVirtualClient(@Req() req: AuthRequest, @Body() body: { name: string }) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    if (!body.name?.trim()) throw new BadRequestException('name required');
    return this.therapyService.addVirtualClient(req.telegramUserId, body.name);
  }

  @Post('clients/add')
  async addClientManually(@Req() req: AuthRequest, @Body() body: { clientTelegramId: number }) {
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
    void req; void body;
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
  @Throttle({ short: { limit: 2, ttl: 60_000 }, long: { limit: 5, ttl: 24 * 3_600_000 } })
  async submitRequest(@Req() req: AuthRequest, @Body() body: {
    fullName: string; qualification: string; contacts: string; message?: string;
  }) {
    return this.therapistRequestService.submit(req.telegramUserId, body);
  }

  @Get('request')
  async getMyRequest(@Req() req: AuthRequest) {
    const row = await this.therapistRequestService.getMine(req.telegramUserId);
    return row ?? null;
  }

  // ─── Tasks ───────────────────────────────────────────────────────────────────

  @Post('tasks')
  async createTask(@Req() req: AuthRequest, @Body() body: {
    type: string; text: string; targetDays?: number;
    needId?: string; dueDate?: string; clientId?: number;
  }) {
    if (!body.type || !body.text) throw new BadRequestException('type and text required');
    if (body.targetDays !== undefined && (!Number.isInteger(body.targetDays) || body.targetDays < 1 || body.targetDays > 365)) throw new BadRequestException('targetDays must be 1–365');
    let targetUserId = req.telegramUserId;
    let assignedBy: number | undefined;

    if (body.clientId) {
      const role = await this.botService.getUserRole(req.telegramUserId);
      if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
      // SECURITY: assert there is an actual therapy relation. Without this
      // any THERAPIST can inject tasks into ANY user's account.
      try {
        await this.therapyService.assertHasClient(req.telegramUserId, body.clientId);
      } catch {
        throw new ForbiddenException('No therapy relation with this client');
      }
      targetUserId = body.clientId;
      assignedBy = req.telegramUserId;
    }

    const task = await this.therapyService.createTask(targetUserId, body, assignedBy);
    if (assignedBy && targetUserId > 0) {
      // Pass original (plaintext) body so the notification payload is readable
      await this.therapyService.scheduleTaskNotification(targetUserId, { text: body.text, needId: body.needId ?? null, dueDate: body.dueDate ?? null });
    }
    return task;
  }

  @Get('tasks')
  async getTasks(@Req() req: AuthRequest) {
    return this.therapyService.getTasks(req.telegramUserId);
  }

  @Get('tasks/history')
  async getTaskHistory(@Req() req: AuthRequest) {
    return this.therapyService.getTaskHistory(req.telegramUserId);
  }

  @Get('tasks/all')
  async getAllTasks(@Req() req: AuthRequest) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    return this.therapyService.getAllTasksForTherapist(req.telegramUserId);
  }

  @Get('tasks/client/:clientId')
  async getTasksForClient(@Req() req: AuthRequest, @Param('clientId') clientId: string) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    const tasks = await this.therapyService.getTasksForClient(req.telegramUserId, parseId(clientId));
    if (tasks === null) throw new ForbiddenException('No active relation with this client');
    return tasks;
  }

  @Post('tasks/:id/complete')
  async completeTask(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: { done: boolean }) {
    const owned = await this.therapyService.completeTask(req.telegramUserId, parseId(id), body.done);
    if (!owned) throw new ForbiddenException('Task not found or not yours');
    return { ok: true };
  }

  // ─── Client data ─────────────────────────────────────────────────────────────

  @Post('rename-client/:clientId')
  async renameClient(@Req() req: AuthRequest, @Param('clientId') clientId: string, @Body() body: { alias: string }) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    if (typeof body.alias !== 'string') throw new BadRequestException('alias required');
    if (body.alias.length > 100) throw new BadRequestException('alias too long');
    await this.therapyService.renameClient(req.telegramUserId, parseId(clientId), body.alias);
    return { ok: true };
  }

  @Post('request-ysq/:clientId')
  async requestYsq(@Req() req: AuthRequest, @Param('clientId') clientId: string) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try { await this.therapyService.requestYsq(req.telegramUserId, parseId(clientId)); }
    catch (e: any) { if (e?.message === 'No active relation') throw new ForbiddenException('No active relation with this client'); throw e; }
    return { ok: true };
  }

  @Get('client/:clientId/diary')
  async getClientDiary(@Req() req: AuthRequest, @Param('clientId') clientId: string) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try { return await this.therapyService.getClientDiaryEntries(req.telegramUserId, parseId(clientId)); }
    catch (e: any) { if (e?.message === 'No active relation') throw new ForbiddenException('No active relation with this client'); throw e; }
  }

  @Get('client-history/:clientId')
  async getClientHistory(@Req() req: AuthRequest, @Param('clientId') clientId: string) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try { return await this.therapyService.getClientHistory(req.telegramUserId, parseId(clientId)); }
    catch (e: any) { if (e?.message === 'No active relation') throw new ForbiddenException('No active relation with this client'); throw e; }
  }

  @Get('client-data/:clientId')
  async getClientData(@Req() req: AuthRequest, @Param('clientId') clientId: string) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try { return await this.therapyService.getClientData(req.telegramUserId, parseId(clientId)); }
    catch (e: any) { if (e?.message === 'No active relation') throw new ForbiddenException('No active relation with this client'); throw e; }
  }

  // ─── Session Notes ───────────────────────────────────────────────────────────

  @Get('notes/:clientId')
  async getNotes(@Req() req: AuthRequest, @Param('clientId') clientId: string) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try { return await this.therapyService.getNotes(req.telegramUserId, parseId(clientId)); }
    catch (e: any) { if (e?.message === 'No active relation') throw new ForbiddenException('No active relation with this client'); throw e; }
  }

  @Post('notes/:clientId')
  async createNote(@Req() req: AuthRequest, @Param('clientId') clientId: string, @Body() body: { date: string; text: string }) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    if (!body.text?.trim()) throw new BadRequestException('text required');
    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw new BadRequestException('Invalid date');
    const note = { date: body.date, text: body.text.slice(0, 5000) };
    try { return await this.therapyService.createNote(req.telegramUserId, parseId(clientId), note); }
    catch (e: any) { if (e?.message === 'No active relation') throw new ForbiddenException('No active relation with this client'); throw e; }
  }

  @Delete('notes/:noteId')
  async deleteNote(@Req() req: AuthRequest, @Param('noteId') noteId: string) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    await this.therapyService.deleteNote(req.telegramUserId, parseId(noteId));
    return { ok: true };
  }

  // ─── Case Conceptualization ──────────────────────────────────────────────────

  @Get('conceptualization/:clientId')
  async getConceptualization(@Req() req: AuthRequest, @Param('clientId') clientId: string) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try { return await this.therapyService.getConceptualization(req.telegramUserId, parseId(clientId)); }
    catch (e: any) { if (e?.message === 'No active relation') throw new ForbiddenException('No active relation with this client'); throw e; }
  }

  @Post('session-info/:clientId')
  async updateSessionInfo(@Req() req: AuthRequest, @Param('clientId') clientId: string, @Body() body: {
    therapyStartDate?: string | null; nextSession?: string | null; meetingDays?: number[];
  }) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try { await this.therapyService.updateSessionInfo(req.telegramUserId, parseId(clientId), body); }
    catch (e: any) { if (e?.message === 'No active relation') throw new ForbiddenException('No active relation with this client'); throw e; }
    return { ok: true };
  }

  @Post('conceptualization/:clientId')
  async saveConceptualization(@Req() req: AuthRequest, @Param('clientId') clientId: string, @Body() body: {
    schemaIds?: string[]; modeIds?: string[];
    earlyExperience?: string; unmetNeeds?: string;
    triggers?: string; copingStyles?: string; goals?: string; currentProblems?: string;
    modeTransitions?: string;
  }) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try { return await this.therapyService.saveConceptualization(req.telegramUserId, parseId(clientId), body); }
    catch (e: any) { if (e?.message === 'No active relation') throw new ForbiddenException('No active relation with this client'); throw e; }
  }
}
