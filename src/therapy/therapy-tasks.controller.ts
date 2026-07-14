import {
  Body,
  Controller,
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
import { TherapyRelationsService } from './therapy-relations.service';
import { TherapyTasksService } from './therapy-tasks.service';
import { TherapyTasksViewService } from './therapy-tasks-view.service';
import { AccountService } from '../bot/account.service';
import { CreateTaskDto, CompleteTaskDto } from './dto/tasks.dto';

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

// Задачи терапевта клиенту: создание, список, история, отметка выполнения.
@Controller('api/therapy')
@UseGuards(TelegramAuthGuard)
export class TherapyTasksController {
  constructor(
    private readonly relationsService: TherapyRelationsService,
    private readonly tasksService: TherapyTasksService,
    private readonly tasksViewService: TherapyTasksViewService,
    private readonly accountService: AccountService,
  ) {}

  @Post('tasks')
  async createTask(@Req() req: AuthRequest, @Body() body: CreateTaskDto) {
    let targetUserId: bigint = uid(req);
    let assignedBy: bigint | undefined;

    if (body.clientId) {
      const role = await this.accountService.getUserRole(uid(req));
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
    const role = await this.accountService.getUserRole(uid(req));
    if (role !== 'THERAPIST') throw new ForbiddenException('Therapist only');
    return this.tasksViewService.getAllTasksForTherapist(uid(req));
  }

  @Get('tasks/client/:clientId')
  async getTasksForClient(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
  ) {
    const role = await this.accountService.getUserRole(uid(req));
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
}
