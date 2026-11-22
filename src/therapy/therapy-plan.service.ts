import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { TherapyPlanItem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TherapyRelationsService } from './therapy-relations.service';
import { encryptRecord } from '../utils/crypto-record';
import type { PlanItemView, PlanSource } from './therapy-plan.types';
import { PLAN_SCHEMA, toView } from './therapy-plan.view';
import { parseGuideAddress } from './guide-mark-address';
import { assertPhaseOfPair } from './therapy-plan.phase';

export interface PlanItemInput {
  rubric: string;
  text: string;
  /** Адрес раздела справочника, из которого взят пункт. */
  sourceAddress?: string;
  /** Старый клиент (до адресов) шлёт вид/id/поле — пишутся как раньше. */
  source?: PlanSource;
  /** Фаза пути клиента; допустима только при одном клиенте. */
  phaseId?: number;
}

export interface PlanItemPatch {
  text?: string;
  status?: string;
  rubric?: string;
  taskId?: number | null;
  phaseId?: number | null;
}

// План работы с клиентом: пункты терапевта, клиенту не показываются. Доступ —
// TherapyRelationsService.assertHasClient ('No active relation' → 403 в
// контроллере); правка и удаление по id перепроверяют связь с клиентом пункта.
@Injectable()
export class TherapyPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly relationsService: TherapyRelationsService,
  ) {}

  async list(therapistId: bigint, clientId: bigint): Promise<PlanItemView[]> {
    await this.relationsService.assertHasClient(therapistId, clientId);
    const rows = await this.prisma.therapyPlanItem.findMany({
      where: { therapistId, clientId },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toView);
  }

  /** Один пункт сразу нескольким клиентам: чужой клиент в списке — отказ всем. */
  async create(
    therapistId: bigint,
    clientIds: bigint[],
    input: PlanItemInput,
  ): Promise<PlanItemView[]> {
    if (input.sourceAddress && !parseGuideAddress(input.sourceAddress))
      throw new BadRequestException('Bad guide address');
    for (const clientId of clientIds) {
      await this.relationsService.assertHasClient(therapistId, clientId);
    }
    if (input.phaseId != null) {
      if (clientIds.length !== 1)
        throw new BadRequestException('Phase needs a single client');
      await assertPhaseOfPair(
        this.prisma,
        { therapistId, clientId: clientIds[0] },
        input.phaseId,
      );
    }
    const rows = await this.prisma.$transaction(async (tx) => {
      const created: TherapyPlanItem[] = [];
      for (const clientId of clientIds) {
        const last = await tx.therapyPlanItem.findFirst({
          where: { therapistId, clientId },
          orderBy: { position: 'desc' },
          select: { position: true },
        });
        created.push(
          await tx.therapyPlanItem.create({
            data: encryptRecord(
              {
                therapistId,
                clientId,
                rubric: input.rubric,
                text: input.text,
                position: (last?.position ?? -1) + 1,
                sourceAddress: input.sourceAddress ?? null,
                sourceKind: input.source?.kind ?? null,
                sourceId: input.source?.id ?? null,
                sourceField: input.source?.field ?? null,
                phaseId: input.phaseId ?? null,
              },
              PLAN_SCHEMA,
            ),
          }),
        );
      }
      return created;
    });
    return rows.map(toView);
  }

  async update(
    therapistId: bigint,
    id: number,
    patch: PlanItemPatch,
  ): Promise<PlanItemView> {
    const item = await this.owned(therapistId, id);
    if (patch.taskId != null) {
      // Отметка «выдано заданием» — только задание этого терапевта этому клиенту.
      const task = await this.prisma.userTask.findFirst({
        where: {
          id: patch.taskId,
          userId: item.clientId,
          assignedBy: therapistId,
        },
        select: { id: true },
      });
      if (!task) throw new NotFoundException('Task not found');
    }
    if (patch.phaseId != null)
      await assertPhaseOfPair(
        this.prisma,
        { therapistId, ...item },
        patch.phaseId,
      );
    const data = encryptRecord(
      {
        ...(patch.text !== undefined && { text: patch.text }),
        ...(patch.status !== undefined && { status: patch.status }),
        ...(patch.rubric !== undefined && { rubric: patch.rubric }),
        ...(patch.taskId !== undefined && { taskId: patch.taskId }),
        ...(patch.phaseId !== undefined && { phaseId: patch.phaseId }),
      },
      PLAN_SCHEMA,
    );
    const row = await this.prisma.therapyPlanItem.update({
      where: { id: item.id },
      data,
    });
    return toView(row);
  }

  async remove(therapistId: bigint, id: number): Promise<void> {
    const item = await this.owned(therapistId, id);
    await this.prisma.therapyPlanItem.delete({ where: { id: item.id } });
  }

  /** Новый порядок: ids — все пункты плана клиента, в нужной последовательности. */
  async reorder(
    therapistId: bigint,
    clientId: bigint,
    ids: number[],
  ): Promise<void> {
    await this.relationsService.assertHasClient(therapistId, clientId);
    await this.prisma.$transaction(async (tx) => {
      const own = await tx.therapyPlanItem.findMany({
        where: { therapistId, clientId },
        select: { id: true },
      });
      const known = new Set(own.map((r) => r.id));
      if (ids.length !== known.size || ids.some((id) => !known.has(id)))
        throw new NotFoundException('Plan items mismatch');
      for (const [position, id] of ids.entries()) {
        await tx.therapyPlanItem.update({ where: { id }, data: { position } });
      }
    });
  }

  // Пункт этого терапевта у его текущего клиента; чужой и несуществующий — 404.
  private async owned(therapistId: bigint, id: number) {
    const item = await this.prisma.therapyPlanItem.findFirst({
      where: { id, therapistId },
      select: { id: true, clientId: true },
    });
    if (!item) throw new NotFoundException('Plan item not found');
    await this.relationsService.assertHasClient(therapistId, item.clientId);
    return item;
  }
}
