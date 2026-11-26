// Сводная карточка дневника: тип, число записей, дата первой записи.
// Приватный текст записей в картинку НЕ попадает — только счётчики.
// Лист персика дневника со знаком Pebbles (ENTITY_LOOK diary); цвет и эмодзи
// дневника на картинку не идут — эмодзи остаётся только в тексте шаринга.
import {
  CARD_LOOK,
  FOOTER_H,
  STAT_TILE_H,
  beginCard,
  header,
  headerHeight,
  footer,
  drawStatTiles,
  type StatTile,
} from '../cardKit';
import { pluralEntries } from '../shareTexts';

export interface DiaryCardData {
  /** Эмодзи дневника — только для текста шаринга, на картинку не идёт. */
  emoji?: string;
  title: string;
  /** Цвет дневника на сайте; лист карточки — бумага дневника (CARD_LOOK.diary). */
  color?: string;
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
  const H =
    headerHeight(1, Boolean(subtitle)) + 4 + STAT_TILE_H + 14 + FOOTER_H;
  const c = beginCard(canvas, H, { hue: CARD_LOOK.diary.hue });

  const contentY = header(c, {
    eyebrow: 'Дневник',
    title: d.title,
    subtitle,
    sign: CARD_LOOK.diary.sign,
  });

  const tiles: StatTile[] = [
    { label: 'Записей', value: String(d.count), hint: pluralEntries(d.count) },
  ];
  if (d.since) tiles.push({ label: 'Первая запись', value: d.since });
  drawStatTiles(c, tiles, contentY + 4);

  footer(c, d.title);
}
