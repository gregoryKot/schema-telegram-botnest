// Сводная карточка дневника: тип, число записей, дата первой записи.
// Приватный текст записей в картинку НЕ попадает — только счётчики.
import {
  CARD_PAD,
  FOOTER_H,
  beginCard,
  accentBar,
  header,
  footer,
  cardFont,
  resolveCardTheme,
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
  const H = 120 + 96 + FOOTER_H;
  const c = beginCard(canvas, H);
  const { ctx, th } = c;
  const color = resolveCardTheme().color(d.color);

  accentBar(c, color, color);
  header(c, `${d.emoji} ${d.title}`);

  const y = 148;
  ctx.font = cardFont(11);
  ctx.fillStyle = th.fg(0.35);
  ctx.textAlign = 'left';
  ctx.fillText('Записей', CARD_PAD, y);

  ctx.font = cardFont(30, 'bold');
  ctx.fillStyle = th.fg(0.95);
  ctx.fillText(String(d.count), CARD_PAD, y + 36);
  const countW = ctx.measureText(String(d.count)).width;

  ctx.font = cardFont(13);
  ctx.fillStyle = color;
  ctx.fillText(pluralEntries(d.count), CARD_PAD + countW + 8, y + 36);

  if (d.since) {
    ctx.textAlign = 'right';
    ctx.font = cardFont(11);
    ctx.fillStyle = th.fg(0.35);
    ctx.fillText('Веду с', c.W - CARD_PAD, y);
    ctx.font = cardFont(17, 'bold');
    ctx.fillStyle = th.fg(0.85);
    ctx.fillText(d.since, c.W - CARD_PAD, y + 33);
    ctx.textAlign = 'left';
  }

  footer(c, d.title);
}
