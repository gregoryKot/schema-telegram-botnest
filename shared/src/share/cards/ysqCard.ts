// Карточка результата теста на схемы: счёт выраженных схем + топ схем с
// обеими метриками (классика «5–6» и средний балл). Персональные данные —
// только агрегаты (названия схем и проценты), без ответов на вопросы.
import {
  CARD_PAD,
  CARD_W,
  FOOTER_H,
  beginCard,
  accentBar,
  header,
  footer,
  cardFont,
  measureWrap,
  clampLines,
} from '../cardKit';

export interface YsqCardSchema {
  name: string;
  /** CSS-переменная или hex — резолвится китом */
  color: string;
  pct5plus: number;
  avg: number;
}

export const YSQ_CARD_MAX_ROWS = 6;

/** Топ схем для карточки + сколько не влезло. */
export function ysqCardRows(
  active: YsqCardSchema[],
  max = YSQ_CARD_MAX_ROWS,
): { rows: YsqCardSchema[]; moreCount: number } {
  return {
    rows: active.slice(0, max),
    moreCount: Math.max(0, active.length - max),
  };
}

export function pluralActiveSchemas(n: number): string {
  if (n === 1) return 'выраженная схема';
  if (n >= 2 && n <= 4) return 'выраженные схемы';
  return 'выраженных схем';
}

// Короткий текст шаринга (уходит вместе с картинкой). 1-е лицо, без рода
// и без ты/вы — правило shareTexts.
export function buildYsqShareText(activeCount: number, link: string): string {
  const head =
    activeCount === 0
      ? '🧠 Мой результат теста на схемы: выраженных схем не обнаружено.'
      : `🧠 Мой результат теста на схемы: ${activeCount} ${pluralActiveSchemas(activeCount)} из 20.`;
  return `${head}\n\n${link}`;
}

// Готовые пропсы для ShareCardSheet обоих фронтендов (одно место сборки,
// чтобы вилка webapp/miniapp не расползалась и не плодила клоны).
export function ysqShareCard(
  scores: Record<string, { pct5plus: number; avg: number }>,
  view: {
    activeCount: number;
    dateLabel: string | null;
    activeSchemas: { name: string; color: string }[];
  },
  link: string,
) {
  const rows: YsqCardSchema[] = view.activeSchemas.map((s) => ({
    name: s.name,
    color: s.color,
    pct5plus: scores[s.name]?.pct5plus ?? 0,
    avg: scores[s.name]?.avg ?? 0,
  }));
  return {
    title: 'Результат теста',
    draw: (canvas: HTMLCanvasElement) =>
      drawYsqCard(canvas, rows, view.dateLabel),
    shareText: buildYsqShareText(view.activeCount, link),
    filename: 'schema-test.png',
    eventKind: 'ysq' as const,
  };
}

const ROW_H = 42;

export function drawYsqCard(
  canvas: HTMLCanvasElement,
  active: YsqCardSchema[],
  dateLabel: string | null,
) {
  const { rows, moreCount } = ysqCardRows(active);
  const emptyH = rows.length === 0 ? 26 : 0;
  const moreH = moreCount > 0 ? 22 : 0;
  const H = 112 + 32 + rows.length * ROW_H + emptyH + moreH + 10 + FOOTER_H;

  const c = beginCard(canvas, H);
  const { ctx, th } = c;
  const maxW = CARD_W - CARD_PAD * 2;

  accentBar(c);
  let y = header(c, 'Тест на схемы', dateLabel ?? undefined);

  ctx.font = cardFont(15, 'bold');
  ctx.fillStyle = th.fg(0.92);
  ctx.textAlign = 'left';
  ctx.fillText(
    rows.length === 0
      ? 'Выраженных схем не обнаружено'
      : `${active.length} ${pluralActiveSchemas(active.length)}`,
    CARD_PAD,
    y + 8,
  );
  y += 32;

  for (const s of rows) {
    const color = th.color(s.color);
    const metric = `${s.avg}/6 · ${s.pct5plus}%`;
    ctx.font = cardFont(12, 'bold');
    const metricW = ctx.measureText(metric).width;

    const name = clampLines(
      measureWrap(canvas, s.name, maxW - metricW - 14, 13),
      1,
    )[0];
    ctx.font = cardFont(13);
    ctx.fillStyle = th.fg(0.8);
    ctx.textAlign = 'left';
    ctx.fillText(name, CARD_PAD, y + 14);

    ctx.font = cardFont(12, 'bold');
    ctx.fillStyle = color;
    ctx.textAlign = 'right';
    ctx.fillText(metric, CARD_W - CARD_PAD, y + 14);
    ctx.textAlign = 'left';

    // бар — по среднему баллу (1 → пусто, 6 → полный)
    const fillW = Math.max(4, ((s.avg - 1) / 5) * maxW);
    ctx.fillStyle = th.fg(0.07);
    ctx.beginPath();
    ctx.roundRect(CARD_PAD, y + 22, maxW, 5, 2.5);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(CARD_PAD, y + 22, fillW, 5, 2.5);
    ctx.fill();

    y += ROW_H;
  }

  if (moreCount > 0) {
    ctx.font = cardFont(12);
    ctx.fillStyle = th.fg(0.4);
    ctx.fillText(`+ ещё ${moreCount}`, CARD_PAD, y + 10);
  }

  footer(c, 'Тест на схемы');
}
