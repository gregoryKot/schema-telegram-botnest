import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { TherapyPath } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { encryptRecord } from '../utils/crypto-record';
import { TherapyRelationsService } from './therapy-relations.service';
import {
  PATH_PHASES_MAX,
  type PathPhaseDraft,
  type PathPhasePatch,
  type TherapyPathView,
} from './therapy-path.types';
import {
  PATH_PHASE_SCHEMA,
  pathView,
  phaseData,
  phasesInOrder,
} from './therapy-path.view';

export interface PathInput {
  startDate: string;
  templateId?: string | null;
  phases: PathPhaseDraft[];
}

// Путь клиента: фазы терапии со сроками, клиенту не показывается. Доступ —
// assertHasClient ('No active relation' → 403 в контроллере); по id фазы связь
// перепроверяется через её путь, чужая фаза — 404.
@Injectable()
export class TherapyPathService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly relationsService: TherapyRelationsService,
  ) {}

  async get(
    therapistId: bigint,
    clientId: bigint,
  ): Promise<TherapyPathView | null> {
    await this.relationsService.assertHasClient(therapistId, clientId);
    const path = await this.find(therapistId, clientId);
    return path && pathView(this.prisma, path);
  }

  async create(
    therapistId: bigint,
    clientId: bigint,
    input: PathInput,
  ): Promise<TherapyPathView> {
    await this.relationsService.assertHasClient(therapistId, clientId);
    return this.prisma.$transaction(async (tx) => {
      // Гонку двух созданий добивает @@unique (P2002 → 409 в фильтре Prisma).
      const taken = await tx.therapyPath.findFirst({
        where: { therapistId, clientId },
        select: { id: true },
      });
      if (taken) throw new ConflictException('Path already exists');
      const path = await tx.therapyPath.create({
        data: {
          therapistId,
          clientId,
          startDate: input.startDate,
          templateId: input.templateId ?? null,
        },
      });
      for (const [position, draft] of input.phases.entries()) {
        await tx.therapyPathPhase.create({
          data: phaseData(path.id, position, draft),
        });
      }
      return pathView(tx, path);
    });
  }

  async setStart(
    therapistId: bigint,
    clientId: bigint,
    startDate: string,
  ): Promise<TherapyPathView> {
    const { id } = await this.mine(therapistId, clientId);
    const path = await this.prisma.therapyPath.update({
      where: { id },
      data: { startDate },
    });
    return pathView(this.prisma, path);
  }

  /** Нет пути — тоже успех: повторное удаление не ошибка. */
  async remove(therapistId: bigint, clientId: bigint): Promise<void> {
    await this.relationsService.assertHasClient(therapistId, clientId);
    const path = await this.find(therapistId, clientId);
    if (!path) return;
    // Фазы уходят каскадом, пункты плана теряют phaseId (SetNull).
    await this.prisma.therapyPath.delete({ where: { id: path.id } });
  }

  async addPhase(
    therapistId: bigint,
    clientId: bigint,
    draft: PathPhaseDraft,
  ): Promise<TherapyPathView> {
    const path = await this.mine(therapistId, clientId);
    return this.prisma.$transaction(async (tx) => {
      const phases = await phasesInOrder(tx, path.id);
      if (phases.length >= PATH_PHASES_MAX)
        throw new BadRequestException('Too many phases');
      const last = phases.at(-1)?.position ?? -1;
      await tx.therapyPathPhase.create({
        data: phaseData(path.id, last + 1, draft),
      });
      return pathView(tx, path);
    });
  }

  async updatePhase(
    therapistId: bigint,
    id: number,
    patch: PathPhasePatch,
  ): Promise<TherapyPathView> {
    const { phase, path } = await this.ownedPhase(therapistId, id);
    const data = encryptRecord(
      {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.goal !== undefined && { goal: patch.goal }),
        ...(patch.weeks !== undefined && { weeks: patch.weeks }),
        ...(patch.note !== undefined && { note: patch.note }),
        ...(patch.criteriaDone !== undefined && {
          criteriaDone: patch.criteriaDone,
        }),
        ...(patch.startedAt !== undefined && { startedAt: patch.startedAt }),
        ...(patch.endedAt !== undefined && { endedAt: patch.endedAt }),
      },
      PATH_PHASE_SCHEMA,
    );
    await this.prisma.therapyPathPhase.update({
      where: { id: phase.id },
      data,
    });
    return pathView(this.prisma, path);
  }

  /** Закрыть фазу днём `date` и тем же днём начать следующую по position. */
  async advance(
    therapistId: bigint,
    id: number,
    date: string,
  ): Promise<TherapyPathView> {
    const { phase, path } = await this.ownedPhase(therapistId, id);
    return this.prisma.$transaction(async (tx) => {
      const phases = await phasesInOrder(tx, path.id);
      const next = phases[phases.findIndex((p) => p.id === phase.id) + 1];
      await tx.therapyPathPhase.update({
        where: { id: phase.id },
        data: { endedAt: date },
      });
      if (next) {
        await tx.therapyPathPhase.update({
          where: { id: next.id },
          data: { startedAt: date },
        });
      }
      return pathView(tx, path);
    });
  }

  /** Новый порядок: ids — все фазы пути, в нужной последовательности. */
  async reorder(
    therapistId: bigint,
    clientId: bigint,
    ids: number[],
  ): Promise<TherapyPathView> {
    const path = await this.mine(therapistId, clientId);
    return this.prisma.$transaction(async (tx) => {
      const known = new Set(
        (await phasesInOrder(tx, path.id)).map((p) => p.id),
      );
      if (ids.length !== known.size || ids.some((id) => !known.has(id)))
        throw new BadRequestException('Path phases mismatch');
      for (const [position, id] of ids.entries()) {
        await tx.therapyPathPhase.update({ where: { id }, data: { position } });
      }
      return pathView(tx, path);
    });
  }

  async removePhase(therapistId: bigint, id: number): Promise<TherapyPathView> {
    const { phase, path } = await this.ownedPhase(therapistId, id);
    await this.prisma.therapyPathPhase.delete({ where: { id: phase.id } });
    return pathView(this.prisma, path);
  }

  private find(therapistId: bigint, clientId: bigint) {
    return this.prisma.therapyPath.findFirst({
      where: { therapistId, clientId },
    });
  }

  // Путь своего клиента; пути ещё нет — 404.
  private async mine(therapistId: bigint, clientId: bigint) {
    await this.relationsService.assertHasClient(therapistId, clientId);
    const path = await this.find(therapistId, clientId);
    if (!path) throw new NotFoundException('Path not found');
    return path;
  }

  // Фаза → путь этого терапевта → текущий клиент; иначе 404, без различий.
  private async ownedPhase(therapistId: bigint, id: number) {
    const phase = await this.prisma.therapyPathPhase.findFirst({
      where: { id },
      select: { id: true, pathId: true },
    });
    const path: TherapyPath | null = phase
      ? await this.prisma.therapyPath.findFirst({
          where: { id: phase.pathId, therapistId },
        })
      : null;
    if (!phase || !path) throw new NotFoundException('Phase not found');
    try {
      await this.relationsService.assertHasClient(therapistId, path.clientId);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'No active relation')
        throw new NotFoundException('Phase not found');
      throw e;
    }
    return { phase, path };
  }
}
