import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpException, Logger, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { TherapyService } from './therapy.service';
import { BotService } from '../bot/bot.service';

interface AuthRequest extends Request {
  telegramUserId: number;
  userRole?: string;
}

function parseId(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new BadRequestException('Invalid id');
  return n;
}

@Controller('api/therapy')
@UseGuards(TelegramAuthGuard)
export class TherapyController {
  private readonly logger = new Logger(TherapyController.name);

  constructor(
    private readonly therapyService: TherapyService,
    private readonly botService: BotService,
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

  @Post('clients/virtual')
  async addVirtualClient(@Req() req: AuthRequest, @Body() body: { name: string }) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    if (!body.name?.trim()) throw new BadRequestException('name required');
    return this.therapyService.addVirtualClient(req.telegramUserId, body.name);
  }

  @Post('clients/add')
  async addClientManually(@Req() req: AuthRequest, @Body() body: { clientTelegramId: number }) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try {
      return await this.therapyService.addClientManually(req.telegramUserId, body.clientTelegramId);
    } catch (e: any) {
      throw new BadRequestException(e.message ?? 'Error');
    }
  }

  @Post('become-therapist')
  async becomeTherapist(@Req() req: AuthRequest, @Body() body: { code: string }) {
    const expected = process.env.THERAPIST_CODE;
    if (!expected || body.code !== expected) throw new ForbiddenException('Invalid code');
    await this.botService.setRole(req.telegramUserId, 'THERAPIST');
    return { ok: true };
  }

  // ─── Tasks ───────────────────────────────────────────────────────────────────

  @Post('tasks')
  async createTask(@Req() req: AuthRequest, @Body() body: {
    type: string; text: string; targetDays?: number;
    needId?: string; dueDate?: string; clientId?: number;
  }) {
    if (!body.type || !body.text) throw new BadRequestException('type and text required');
    let targetUserId = req.telegramUserId;
    let assignedBy: number | undefined;

    if (body.clientId) {
      const role = await this.botService.getUserRole(req.telegramUserId);
      if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
      targetUserId = body.clientId;
      assignedBy = req.telegramUserId;
    }

    const task = await this.therapyService.createTask(targetUserId, body, assignedBy);
    if (assignedBy) {
      await this.therapyService.scheduleTaskNotification(targetUserId, task);
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
    await this.therapyService.completeTask(req.telegramUserId, parseId(id), body.done);
    return { ok: true };
  }

  // ─── Client data ─────────────────────────────────────────────────────────────

  @Post('rename-client/:clientId')
  async renameClient(@Req() req: AuthRequest, @Param('clientId') clientId: string, @Body() body: { alias: string }) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    if (typeof body.alias !== 'string') throw new BadRequestException('alias required');
    await this.therapyService.renameClient(req.telegramUserId, parseId(clientId), body.alias);
    return { ok: true };
  }

  @Post('request-ysq/:clientId')
  async requestYsq(@Req() req: AuthRequest, @Param('clientId') clientId: string) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try { await this.therapyService.requestYsq(req.telegramUserId, parseId(clientId)); }
    catch { throw new ForbiddenException('No active relation with this client'); }
    return { ok: true };
  }

  @Get('client-data/:clientId')
  async getClientData(@Req() req: AuthRequest, @Param('clientId') clientId: string) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try { return await this.therapyService.getClientData(req.telegramUserId, parseId(clientId)); }
    catch { throw new ForbiddenException('No active relation with this client'); }
  }

  // ─── Session Notes ───────────────────────────────────────────────────────────

  @Get('notes/:clientId')
  async getNotes(@Req() req: AuthRequest, @Param('clientId') clientId: string) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try { return await this.therapyService.getNotes(req.telegramUserId, parseId(clientId)); }
    catch { throw new ForbiddenException('No active relation with this client'); }
  }

  @Post('notes/:clientId')
  async createNote(@Req() req: AuthRequest, @Param('clientId') clientId: string, @Body() body: { date: string; text: string }) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    if (!body.text?.trim()) throw new BadRequestException('text required');
    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw new BadRequestException('Invalid date');
    try { return await this.therapyService.createNote(req.telegramUserId, parseId(clientId), body); }
    catch { throw new ForbiddenException('No active relation with this client'); }
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
    catch { throw new ForbiddenException('No active relation with this client'); }
  }

  @Post('conceptualization/:clientId')
  async saveConceptualization(@Req() req: AuthRequest, @Param('clientId') clientId: string, @Body() body: {
    schemaIds?: string[]; modeIds?: string[];
    earlyExperience?: string; unmetNeeds?: string;
    triggers?: string; copingStyles?: string; goals?: string; currentProblems?: string;
  }) {
    const role = await this.botService.getUserRole(req.telegramUserId);
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    try { return await this.therapyService.saveConceptualization(req.telegramUserId, parseId(clientId), body); }
    catch { throw new ForbiddenException('No active relation with this client'); }
  }
}
