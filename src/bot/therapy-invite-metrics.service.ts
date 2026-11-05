import { Injectable } from '@nestjs/common';
import {
  THERAPY_INVITE_EVENT,
  THERAPY_INVITE_KINDS,
  THERAPY_INVITE_STEPS,
  type TherapyInviteKind,
  type TherapyInviteStep,
} from '../analytics/therapy-invite-events.constants';
import { PrismaService } from '../prisma/prisma.service';
import {
  formatTherapyInviteMetrics,
  TherapyInviteMetrics,
} from './therapy-invite-metrics.format';

const MONTH_MS = 30 * 86_400_000;
const STEPS = new Set<string>(THERAPY_INVITE_STEPS);
const KINDS = new Set<string>(THERAPY_INVITE_KINDS);

/** Пара step/kind из meta; null — строка не от сервера (ветки в sanitizeMeta нет). */
function pairOf(
  meta: unknown,
): { step: TherapyInviteStep; kind: TherapyInviteKind } | null {
  const m = meta as { step?: unknown; kind?: unknown } | null;
  const step = m?.step;
  const kind = m?.kind;
  if (typeof step !== 'string' || !STEPS.has(step)) return null;
  if (typeof kind !== 'string' || !KINDS.has(kind)) return null;
  return { step: step as TherapyInviteStep, kind: kind as TherapyInviteKind };
}

// Счётчики блока «Приглашения клиентов» для /stats. ОДИН findMany по индексу
// (name, createdAt) и раскладка в памяти: шесть count с JSON-фильтром по meta
// шли шестью полными проходами AnalyticsEvent — гейт планов (правило №28)
// показал +26% страниц на весь /stats. Приглашений — десятки в месяц, строки
// дешевле сканов. Строка без step/kind из списков не считается: событие
// серверное, meta с клиента отбрасывается. Образец — therapist-exit-metrics.
@Injectable()
export class TherapyInviteMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async render(): Promise<string> {
    return formatTherapyInviteMetrics(await this.getMetrics());
  }

  async getMetrics(now = new Date()): Promise<TherapyInviteMetrics> {
    const since = new Date(now.getTime() - MONTH_MS);
    const rows = await this.prisma.analyticsEvent.findMany({
      where: { name: THERAPY_INVITE_EVENT, createdAt: { gte: since } },
      select: { meta: true },
    });
    const out: TherapyInviteMetrics = {
      created: { new: 0, offline: 0 },
      joined: { new: 0, offline: 0 },
      revoked: { new: 0, offline: 0 },
    };
    for (const row of rows) {
      const pair = pairOf(row.meta);
      if (pair) out[pair.step][pair.kind] += 1;
    }
    return out;
  }
}
