import { Injectable } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import {
  THERAPY_INVITE_EVENT,
  type TherapyInviteKind,
  type TherapyInviteStep,
} from '../analytics/therapy-invite-events.constants';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeInviteCode } from './therapy-invite';
import { createInviteFromCard } from './therapy-invite-from-card';
import { TherapyRelationsService } from './therapy-relations.service';

// Приглашения клиентов + событие воронки therapy_invite (правило №8) в одном
// месте, а не в двух контроллерах. TherapyRelationsService не трогаем: его
// конструктор держат десять спеков. Само событие — analytics/therapy-invite-
// events.constants.ts; kind 'offline' — приглашение из карточки офлайн-клиента.
@Injectable()
export class TherapyInviteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly relations: TherapyRelationsService,
    private readonly analytics: AnalyticsService,
  ) {}

  private track(
    userId: bigint,
    step: TherapyInviteStep,
    kind: TherapyInviteKind,
  ): Promise<void> {
    return this.analytics.track(userId, THERAPY_INVITE_EVENT, { step, kind });
  }

  async create(therapistId: bigint, alias?: string) {
    const res = await this.relations.createInvite(therapistId, alias);
    await this.track(therapistId, 'created', 'new');
    return res;
  }

  async createFromCard(therapistId: bigint, cid: bigint) {
    const { created, ...res } = await createInviteFromCard(
      this.prisma,
      therapistId,
      cid,
    );
    if (created) await this.track(therapistId, 'created', 'offline');
    return res;
  }

  async join(clientId: bigint, code: string): Promise<boolean> {
    // До подключения: после него строку приглашения может снести каскад.
    const before = await this.prisma.therapyRelation.findUnique({
      where: { code: normalizeInviteCode(code) },
      select: { attachToId: true },
    });
    const ok = await this.relations.joinAsClient(clientId, code);
    if (ok)
      await this.track(
        clientId,
        'joined',
        before?.attachToId != null ? 'offline' : 'new',
      );
    return ok;
  }

  async revoke(therapistId: bigint, id: number): Promise<boolean> {
    const before = await this.prisma.therapyRelation.findFirst({
      where: { id, therapistId, status: 'pending', clientId: null },
      select: { attachToId: true },
    });
    const ok = await this.relations.revokeInvite(therapistId, id);
    if (ok)
      await this.track(
        therapistId,
        'revoked',
        before?.attachToId != null ? 'offline' : 'new',
      );
    return ok;
  }

  list(therapistId: bigint) {
    return this.relations.listInvites(therapistId);
  }

  preview(clientId: bigint, code: string) {
    return this.relations.previewInvite(clientId, code);
  }
}
