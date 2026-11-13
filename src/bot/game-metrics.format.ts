import {
  GAME_CTA_PLACES,
  GAME_ENTRY_SOURCES,
  type GameChapter,
  type GameCtaPlace,
  type GameEntrySource,
} from '../analytics/game-events.constants';
import {
  GAME_CTA_TARGETS,
  type GameCtaTarget,
} from '../analytics/game-cta.constants';
import type { GameMetrics } from './game-metrics.tally';

// Блок «Игра» для /stats (правило №8): игра — третий фронтенд (game/,
// Phaser), шлёт события анонимно (реестр — game-events.constants.ts). Чистый
// форматтер (тест включает пустую БД), язык без терминов — «поделились игрой».

// Человеческие подписи — то, что видит владелец в /stats, а не сырые слаги.
const SOURCE_LABELS: Record<GameEntrySource, string> = {
  site: 'с сайта',
  bot: 'из бота',
  share: 'по ссылке от друга',
  direct: 'напрямую',
  other: 'с незнакомой меткой',
};

const CTA_TARGET_LABELS: Record<GameCtaTarget, string> = {
  app: 'в приложение',
  booking: 'на запись к терапевту',
};

const CTA_PLACE_LABELS: Record<GameCtaPlace, string> = {
  act1: 'после первой части',
  cabinet: 'в кабинете',
  ending: 'в запасном финале',
};

// 'chapter1' → 'Глава 1' — номер берём из хвоста id, отдельный реестр не нужен.
const chapterLabel = (chapter: GameChapter): string =>
  `Глава ${chapter.replace('chapter', '')}`;

const isEmpty = (m: GameMetrics): boolean =>
  m.opens === 0 &&
  m.starts === 0 &&
  m.chapters.every((c) => c.started === 0) &&
  m.ctaShown === 0 &&
  m.ctaClicks === 0 &&
  m.appArrivals === 0 &&
  m.shares === 0;

/** Текстовый блок для /stats. Чистая функция. */
export function formatGameMetrics(m: GameMetrics): string {
  if (isEmpty(m)) {
    return '🎮 <b>Игра</b>: за 30 дней никто не открывал.';
  }
  const lines = ['🎮 <b>Игра</b> (за месяц)'];

  if (m.opens > 0) {
    const sources = GAME_ENTRY_SOURCES.filter(
      (src) => m.opensBySource[src] > 0,
    ).map((src) => `${SOURCE_LABELS[src]} ${m.opensBySource[src]}`);
    const suffix = sources.length > 0 ? ` — ${sources.join(', ')}` : '';
    lines.push(`Открыли: ${m.opens}${suffix}`);
  }

  if (m.starts > 0) {
    const tutorial =
      m.tutorialDone > 0 || m.tutorialSkipped > 0
        ? ` · обучение прошли ${m.tutorialDone}, пропустили ${m.tutorialSkipped}`
        : '';
    lines.push(`Нажали «начать»: ${m.starts}${tutorial}`);
  }

  const startedChapters = m.chapters.filter((c) => c.started > 0);
  if (startedChapters.length > 0) {
    lines.push('Главы (начали → дошли до конца · экран «сил не осталось»):');
    for (const c of startedChapters) {
      lines.push(
        `• ${chapterLabel(c.chapter)}: ${c.started} → ${c.finished} · ${c.deaths} раз`,
      );
    }
  }

  if (m.ctaShown > 0 || m.ctaClicks > 0) {
    const places = GAME_CTA_PLACES.filter((p) => m.ctaClicksByPlace[p] > 0).map(
      (p) => `${CTA_PLACE_LABELS[p]} ${m.ctaClicksByPlace[p]}`,
    );
    const suffix = places.length > 0 ? ` (${places.join(', ')})` : '';
    lines.push(
      `Приглашение к терапии: увидели ${m.ctaShown}, нажали ${m.ctaClicks}${suffix}`,
    );
    const targets = GAME_CTA_TARGETS.filter(
      (to) => m.ctaClicksByTarget[to] > 0,
    ).map((to) => `${CTA_TARGET_LABELS[to]} ${m.ctaClicksByTarget[to]}`);
    if (targets.length > 0) lines.push(`Куда нажали: ${targets.join(', ')}`);
  }

  if (m.appArrivals > 0) {
    lines.push(`Пришли из игры на сайт: ${m.appArrivals}`);
  }

  if (m.shares > 0) {
    lines.push(`Поделились игрой: ${m.shares}`);
  }

  return lines.join('\n');
}
