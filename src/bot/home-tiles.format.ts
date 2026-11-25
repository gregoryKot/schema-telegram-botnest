// Строка «Главная: плитки» для /stats (правило №8): нажатия плиток и ссылок
// главной сайта за месяц. Чистый форматтер; язык — словами, без id.
import type { DiaryQuickCounts, NextStepCount } from './home-tiles.count';

// Подписи плиток главной — словами, без id. Порядок — как на экране.
export const HOME_TILE_LABELS: Record<string, string> = {
  tracker: 'Трекер',
  case: 'Что случилось',
  diary: 'Дневник',
  calm: 'Подышать',
  why: 'Зачем это',
  feed_all: 'Все записи',
  selfmap: 'Карта себя',
};

/** Строка «Главная: плитки — …» или null, пока на плитки не нажимали. */
export function formatHomeTiles(
  rows: Array<{ tile: string; count: number }>,
): string | null {
  const counts = new Map(rows.map((r) => [r.tile, r.count]));
  const parts = Object.keys(HOME_TILE_LABELS)
    .map((tile) => [HOME_TILE_LABELS[tile], counts.get(tile) ?? 0] as const)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label} ${count}`);
  return parts.length > 0 ? `Главная: плитки — ${parts.join(', ')}` : null;
}

/** Строка «Трекер: пропусков N» или null, пока никто не нажимал «Пропустить». */
export function formatTrackerSkips(count: number): string | null {
  return count > 0 ? `Трекер: пропусков ${count}` : null;
}

// Подписи тегов «Дневника одной страницы» в родительном падеже — после «…:».
const DIARY_QUICK_LABELS: Record<string, string> = {
  thought: 'мыслей',
  schema: 'схем',
  mode: 'режимов',
  gratitude: 'благодарностей',
};

/** Строка «Дневник одной страницей: мыслей N, …; подробно N» или null, пока никто не сохранял. */
export function formatDiaryQuickSaves(c: DiaryQuickCounts): string | null {
  const counts = new Map(c.byTag.map((r) => [r.tag, r.count]));
  const parts = Object.keys(DIARY_QUICK_LABELS)
    .map((tag) => [DIARY_QUICK_LABELS[tag], counts.get(tag) ?? 0] as const)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label} ${count}`);
  if (parts.length === 0) return null;
  const detailed = c.detailed > 0 ? `; подробно ${c.detailed}` : '';
  return `Дневник одной страницей: ${parts.join(', ')}${detailed}`;
}

const NEXT_FROM_LABELS: Record<string, string> = {
  tracker: 'после трекера',
  diary: 'после дневника',
};
const NEXT_TO_LABELS: Record<string, string> = {
  case: 'разобрать случай',
  practice: 'практика',
  mode: 'к режиму',
  schema: 'к схеме',
};

/** Строка «Что дальше: после трекера — …; после дневника — …» или null, пока никто не переходил. */
export function formatDoneNextSteps(rows: NextStepCount[]): string | null {
  const groups = Object.keys(NEXT_FROM_LABELS).flatMap((from) => {
    const parts = Object.keys(NEXT_TO_LABELS)
      .map((to) => {
        const n = rows.find((r) => r.from === from && r.to === to)?.count ?? 0;
        return n > 0 ? `${NEXT_TO_LABELS[to]} ${n}` : null;
      })
      .filter((p): p is string => p !== null);
    return parts.length > 0
      ? [`${NEXT_FROM_LABELS[from]} — ${parts.join(', ')}`]
      : [];
  });
  return groups.length > 0 ? `Что дальше: ${groups.join('; ')}` : null;
}

/** Все строки главной простого клиента для /stats; пустая БД — пустой список. */
export function formatHomeLines(m: {
  homeTiles: Array<{ tile: string; count: number }>;
  trackerSkips: number;
  diaryQuick: DiaryQuickCounts;
  nextSteps: NextStepCount[];
}): string[] {
  return [
    formatHomeTiles(m.homeTiles),
    formatTrackerSkips(m.trackerSkips),
    formatDiaryQuickSaves(m.diaryQuick),
    formatDoneNextSteps(m.nextSteps),
  ].filter((line): line is string => line !== null);
}
