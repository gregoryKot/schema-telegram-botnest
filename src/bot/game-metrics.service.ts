import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  GAME_CHAPTERS,
  GAME_CTA_PLACES,
  GAME_ENTRY_SOURCES,
  GAME_EVENTS,
  type GameChapter,
  type GameCtaPlace,
  type GameEntrySource,
} from '../analytics/game-events.constants';
import { GameMetrics, formatGameMetrics } from './game-metrics.format';

// Счётчики без своей грани (chapter/place/src) — имя события → ключ totals.
const SIMPLE_COUNTERS: Record<
  string,
  'starts' | 'tutorialDone' | 'tutorialSkipped' | 'ctaShown' | 'shares'
> = {
  game_start: 'starts',
  game_tutorial_done: 'tutorialDone',
  game_tutorial_skip: 'tutorialSkipped',
  game_cta_shown: 'ctaShown',
  game_share: 'shares',
};

const zeroRecord = <T extends string>(ids: readonly T[]): Record<T, number> =>
  Object.fromEntries(ids.map((id) => [id, 0])) as Record<T, number>;
const has = (ids: readonly string[], v: string | null): boolean =>
  v !== null && ids.includes(v);

// Блок «Игра» для /stats: игра (game/) не авторизует пользователя (userId =
// null, правило №5/№14, тот же фильтр, что у auth-health-metrics.service.ts).
@Injectable()
export class GameMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatGameMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<GameMetrics> {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const rows = await this.prisma.$queryRaw<
      Array<{
        name: string;
        chapter: string | null;
        place: string | null;
        src: string | null;
        c: bigint;
      }>
    >(Prisma.sql`
      SELECT "name", "meta"->>'chapter' AS chapter, "meta"->>'from' AS place,
             "meta"->>'src' AS src, count(*)::bigint AS c
      FROM "AnalyticsEvent"
      WHERE "name" IN (${Prisma.join(GAME_EVENTS)}) AND "userId" IS NULL
        AND "createdAt" >= ${since30}
      GROUP BY 1, 2, 3, 4`);
    const byChapter = new Map(
      GAME_CHAPTERS.map((c) => [c, { started: 0, finished: 0, deaths: 0 }]),
    );
    const bySource = zeroRecord(GAME_ENTRY_SOURCES);
    const byPlace = zeroRecord(GAME_CTA_PLACES);
    const totals = {
      opens: 0,
      starts: 0,
      tutorialDone: 0,
      tutorialSkipped: 0,
      ctaShown: 0,
      ctaClicks: 0,
      shares: 0,
    };
    for (const row of rows) {
      const c = Number(row.c);
      const simpleKey = SIMPLE_COUNTERS[row.name];
      if (simpleKey) {
        totals[simpleKey] += c;
        continue;
      }
      if (row.name === 'game_open') {
        totals.opens += c;
        const src = has(GAME_ENTRY_SOURCES, row.src)
          ? (row.src as GameEntrySource)
          : 'other';
        bySource[src] += c;
      } else if (row.name === 'game_cta_click') {
        totals.ctaClicks += c;
        if (has(GAME_CTA_PLACES, row.place)) {
          byPlace[row.place as GameCtaPlace] += c;
        }
      } else if (has(GAME_CHAPTERS, row.chapter)) {
        // Глава вне GAME_CHAPTERS (рассинхрон) не портит остальной отчёт.
        const bucket = byChapter.get(row.chapter as GameChapter)!;
        if (row.name === 'game_chapter_start') bucket.started += c;
        else if (row.name === 'game_chapter_done') bucket.finished += c;
        else if (row.name === 'game_over') bucket.deaths += c;
      }
    }
    return {
      ...totals,
      opensBySource: bySource,
      ctaClicksByPlace: byPlace,
      chapters: GAME_CHAPTERS.map((chapter) => ({
        chapter,
        ...byChapter.get(chapter)!,
      })),
    };
  }
}
