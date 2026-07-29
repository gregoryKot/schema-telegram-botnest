// Сводная карточка дневника: тип, число записей, дата первой записи.
// Приватный текст записей в картинку НЕ попадает — только счётчики.
import {
  FOOTER_H,
  beginCard,
  header,
  headerHeight,
  footer,
  drawStatTiles,
  type StatTile,
} from '../cardKit';
import { pluralEntries } from '../shareTexts';

export interface DiaryCardData {
  emoji: string;
  title: string;
  /** CSS-переменная или hex */
  color: string;
  count: number;
  /** «3 мая» — дата первой записи (null, если нет) */
  since: string | null;
}

/** Самая ранняя дата записей → строка «3 мая» (чистая, для тестов). */
export function earliestDateLabel(
  entries: Array<{ createdAt: string }>,
): string | null {
  if (entries.length === 0) return null;
  const min = entries.reduce(
    (acc, e) => (e.createdAt < acc ? e.createdAt : acc),
    entries[0].createdAt,
  );
  const d = new Date(min);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'long' });
}

export function drawDiaryCard(canvas: HTMLCanvasElement, d: DiaryCardData) {
  const subtitle = d.since ? `веду с ${d.since}` : undefined;
  const H = headerHeight(1, Boolean(subtitle)) + 12 + 66 + 16 + FOOTER_H;
  const c = beginCard(canvas, H, { accent: d.color, accent2: 'var(--accent)' });

  const contentY = header(c, {
    eyebrow: 'Дневник',
    title: `${d.emoji} ${d.title}`,
    subtitle,
  });

  const tiles: StatTile[] = [
    { label: 'Записей', value: String(d.count), hint: pluralEntries(d.count) },
  ];
  if (d.since) tiles.push({ label: 'Первая запись', value: d.since });
  drawStatTiles(c, tiles, contentY + 12);

  footer(c, d.title);
}
