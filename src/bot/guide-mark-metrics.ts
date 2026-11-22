// Отметки «Про клиента» из «Справочника» (#1484) — строка блока «Справочник
// терапевта» в /stats. N — события guide_mark_added с kind (пишет только сервер),
// M — разные пары «терапевт — клиент» среди отметок GuideMark за те же 7 дней
// (снятые уже не считаются) и событий копинга: строк GuideMark у копинга нет,
// клиента несёт meta.clientId события.
import type { PrismaService } from '../prisma/prisma.service';
import {
  GUIDE_MARK_KINDS,
  type GuideMarkKind,
} from '../therapy/guide-mark-address';
import { withGuideAnswerLines } from './guide-answer-metrics';

export interface GuideMarkMetrics {
  byKind: Record<GuideMarkKind, number>; // отметок за 7 дней по виду раздела
  clients7: number; // у скольких клиентов (пары терапевт — клиент)
}

const KIND_WORDS: Record<GuideMarkKind, string> = {
  coping: 'копинги',
  schema: 'схемы',
  mode: 'режимы',
  technique: 'техники',
  note: '«Для терапевта»',
  concern: 'запросы',
  phase: 'путь терапии',
};

/** Строка блока; пустая БД — «пока ни одной». Чистая функция. */
export function formatGuideMarkLine(m: GuideMarkMetrics): string {
  const kinds = GUIDE_MARK_KINDS.filter((k) => m.byKind[k] > 0).sort(
    (a, b) => m.byKind[b] - m.byKind[a],
  );
  const total = kinds.reduce((sum, k) => sum + m.byKind[k], 0);
  const head = 'Отметки «Про клиента» за 7 дней';
  if (total === 0) return `${head}: пока ни одной`;
  const clients = m.clients7 > 0 ? `, клиентов — ${m.clients7}` : '';
  const top = kinds.map((k) => `${KIND_WORDS[k]} — ${m.byKind[k]}`).join(', ');
  return `${head}: ${total}${clients}; чаще всего: ${top}`;
}

export async function getGuideMarkMetrics(
  prisma: PrismaService,
): Promise<GuideMarkMetrics> {
  const createdAt = { gte: new Date(Date.now() - 7 * 86_400_000) };
  const [counts, pairs, coping] = await Promise.all([
    Promise.all(
      GUIDE_MARK_KINDS.map((kind) =>
        prisma.analyticsEvent.count({
          where: {
            name: 'guide_mark_added',
            createdAt,
            meta: { path: ['kind'], equals: kind },
          },
        }),
      ),
    ),
    prisma.guideMark.groupBy({
      by: ['therapistId', 'clientId'],
      where: { createdAt },
    }),
    prisma.analyticsEvent.findMany({
      where: {
        name: 'guide_mark_added',
        createdAt,
        meta: { path: ['kind'], equals: 'coping' },
      },
      select: { userId: true, meta: true },
    }),
  ]);
  const clients = new Set(pairs.map((p) => `${p.therapistId}:${p.clientId}`));
  for (const e of coping) {
    const client = (e.meta as { clientId?: unknown } | null)?.clientId;
    if (e.userId != null && typeof client === 'string')
      clients.add(`${e.userId}:${client}`);
  }
  const byKind = Object.fromEntries(
    GUIDE_MARK_KINDS.map((k, i) => [k, counts[i]]),
  ) as Record<GuideMarkKind, number>;
  return { byKind, clients7: clients.size };
}

/** Блок «Справочник терапевта» с дописанными строками: готовый ответ и отметки. */
export async function withGuideExtras(
  prisma: PrismaService,
  block: string,
): Promise<string> {
  const [text, marks] = await Promise.all([
    withGuideAnswerLines(prisma, block),
    getGuideMarkMetrics(prisma),
  ]);
  return [text, formatGuideMarkLine(marks)].join('\n');
}
