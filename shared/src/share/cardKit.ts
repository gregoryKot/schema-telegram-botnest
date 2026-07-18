// Общий canvas-кит share-карточек (share/cards/*). Единственная копия для
// обоих фронтендов (правило №3): визуал строится на CSS-переменных темы
// (--bg, --sheet-bg, --fg-rgb, --accent) и адаптируется к теме каждого фронта.
// Canvas не понимает var() в fillStyle — цвета резолвятся заранее
// (resolveCardTheme, с рекурсивной подстановкой var()-ссылок).
// Чистая логика переноса строк (wrapLines/clampLines) покрыта тестами.

export const CARD_W = 400;
export const CARD_PAD = 28;
const DPR = 2;

export const cardFont = (size: number, weight?: 'bold') =>
  `${weight ? 'bold ' : ''}${size}px -apple-system, BlinkMacSystemFont, sans-serif`;

export interface CardTheme {
  bg: string;
  sheetBg: string;
  accent: string;
  fg: (alpha: number) => string;
  /** 'var(--accent-red)' или '#hex' → конкретный цвет для canvas */
  color: (value: string) => string;
}

export function resolveCardTheme(): CardTheme {
  const cs = getComputedStyle(document.documentElement);
  // Рекурсивная подстановка: '--sheet-bg: var(--bg-elev)' → '#hex'
  const get = (name: string, fallback: string, depth = 0): string => {
    if (depth > 4) return fallback;
    const raw = cs.getPropertyValue(name).trim();
    if (!raw) return fallback;
    const m = /^var\((--[\w-]+)\)$/.exec(raw);
    return m ? get(m[1], fallback, depth + 1) : raw;
  };
  const fgRgb = get('--fg-rgb', '255, 255, 255');
  const color = (value: string): string => {
    const m = /^var\((--[\w-]+)\)$/.exec(value.trim());
    return m ? get(m[1], '#888') : value;
  };
  return {
    bg: get('--bg', '#060a12'),
    sheetBg: get('--sheet-bg', '#141720'),
    accent: get('--accent', '#a78bfa'),
    fg: (alpha) => `rgba(${fgRgb},${alpha})`,
    color,
  };
}

export interface Card {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  th: CardTheme;
}

/** Настраивает канвас (DPR, скруглённый градиентный фон) и возвращает контекст. */
export function beginCard(canvas: HTMLCanvasElement, H: number): Card {
  const W = CARD_W;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(DPR, DPR);

  const th = resolveCardTheme();
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, th.bg);
  bg.addColorStop(1, th.sheetBg);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 20);
  ctx.fill();
  return { ctx, W, H, th };
}

/** Акцентная полоска сверху (градиент от color1 к color2). */
export function accentBar(c: Card, color1?: string, color2 = '#4fa3f7') {
  const grad = c.ctx.createLinearGradient(CARD_PAD, 0, c.W - CARD_PAD, 0);
  grad.addColorStop(0, color1 ?? c.th.accent);
  grad.addColorStop(1, color2);
  c.ctx.strokeStyle = grad;
  c.ctx.lineWidth = 2;
  c.ctx.beginPath();
  c.ctx.moveTo(CARD_PAD, 24);
  c.ctx.lineTo(c.W - CARD_PAD, 24);
  c.ctx.stroke();
}

export function divider(c: Card, y: number, alpha = 0.07) {
  c.ctx.strokeStyle = c.th.fg(alpha);
  c.ctx.lineWidth = 1;
  c.ctx.beginPath();
  c.ctx.moveTo(CARD_PAD, y);
  c.ctx.lineTo(c.W - CARD_PAD, y);
  c.ctx.stroke();
}

/** Заголовок + подзаголовок + разделитель. Возвращает Y начала контента. */
export function header(c: Card, title: string, subtitle?: string): number {
  c.ctx.font = cardFont(17, 'bold');
  c.ctx.fillStyle = c.th.fg(0.95);
  c.ctx.textAlign = 'left';
  c.ctx.fillText(title, CARD_PAD, 56);
  if (subtitle) {
    c.ctx.font = cardFont(12);
    c.ctx.fillStyle = c.th.fg(0.38);
    c.ctx.fillText(subtitle, CARD_PAD, 76);
  }
  divider(c, 96);
  return 112;
}

// Канал проекта — брендовая подпись карточек (захардкожен по всему проекту).
// Бот-ссылка в текст шаринга идёт отдельно через botShortUrl каждого фронта.
const BRAND = '@SchemeHappens';

/** Нижний разделитель + подпись «@SchemeHappens · label». */
export function footer(c: Card, label: string) {
  const y = c.H - 52;
  divider(c, y, 0.05);
  c.ctx.font = cardFont(11);
  c.ctx.fillStyle = c.th.fg(0.25);
  c.ctx.textAlign = 'left';
  c.ctx.fillText(`${BRAND} · ${label}`, CARD_PAD, y + 22);
}

/** Строка трекера в карточке: emoji, подпись, значение, цветной бар. */
export interface NeedRow {
  emoji: string;
  chartLabel: string;
  color: string;
  /** null → «—», бар не рисуется */
  value: number | null;
  /** отформатированное значение (напр. '7.0' для недели, '7' для дня) */
  valueText: string;
}

export const ROW_H = 44;

/** Рисует строки потребностей с барами (общий блок weekly/day карточек). */
export function drawNeedRows(c: Card, rows: NeedRow[], startY = 112) {
  const { ctx, W, th } = c;
  const BAR_MAX_W = 100;
  const BAR_X = W - CARD_PAD - BAR_MAX_W;
  const BAR_H = 7;

  rows.forEach((row, i) => {
    const rowY = startY + i * ROW_H;

    ctx.font = '17px serif';
    ctx.fillStyle = th.fg(0.95);
    ctx.textAlign = 'left';
    ctx.fillText(row.emoji, CARD_PAD, rowY + 20);

    ctx.font = cardFont(13);
    ctx.fillStyle = th.fg(0.7);
    ctx.fillText(row.chartLabel, 52, rowY + 20);

    ctx.font = cardFont(14, 'bold');
    ctx.fillStyle = row.color;
    ctx.textAlign = 'right';
    ctx.fillText(row.valueText, BAR_X - 12, rowY + 20);
    ctx.textAlign = 'left';

    ctx.fillStyle = th.fg(0.07);
    ctx.beginPath();
    ctx.roundRect(BAR_X, rowY + 12, BAR_MAX_W, BAR_H, 3.5);
    ctx.fill();

    if (row.value !== null && row.value > 0) {
      const fillW = Math.max(4, (row.value / 10) * BAR_MAX_W);
      const barGrad = ctx.createLinearGradient(BAR_X, 0, BAR_X + fillW, 0);
      barGrad.addColorStop(0, row.color + 'aa');
      barGrad.addColorStop(1, row.color);
      ctx.fillStyle = barGrad;
      ctx.beginPath();
      ctx.roundRect(BAR_X, rowY + 12, fillW, BAR_H, 3.5);
      ctx.fill();
    }
  });
}

/** Стат-блок «Индекс …»: подпись + крупное значение + «/10» слева. */
export function drawIndexStat(
  c: Card,
  label: string,
  value: number,
  y: number,
) {
  const { ctx, th } = c;
  ctx.font = cardFont(11);
  ctx.fillStyle = th.fg(0.35);
  ctx.textAlign = 'left';
  ctx.fillText(label, CARD_PAD, y);

  ctx.font = cardFont(26, 'bold');
  ctx.fillStyle = th.fg(0.95);
  ctx.fillText(value.toFixed(1), CARD_PAD, y + 30);

  ctx.font = cardFont(11);
  ctx.fillStyle = th.fg(0.28);
  const w = ctx.measureText(value.toFixed(1)).width;
  ctx.fillText('/10', CARD_PAD + w + 2, y + 24);
}

/** Высота футера + его отступ сверху — для расчёта высоты карточки. */
export const FOOTER_H = 56;

/** Чистый перенос по словам. measure — ширина строки в px при нужном шрифте. */
export function wrapLines(
  measure: (s: string) => number,
  text: string,
  maxW: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = words[0];
  for (const word of words.slice(1)) {
    if (measure(`${line} ${word}`) <= maxW) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

/** Обрезает список строк до maxLines, добавляя многоточие к последней. */
export function clampLines(lines: string[], maxLines: number): string[] {
  if (lines.length <= maxLines) return lines;
  const cut = lines.slice(0, maxLines);
  cut[maxLines - 1] = cut[maxLines - 1].replace(/[,.;:]?$/, '…');
  return cut;
}

interface WrapOpts {
  size: number;
  color: string;
  lineH: number;
  maxLines?: number;
  align?: CanvasTextAlign;
  weight?: 'bold';
  italic?: boolean;
}

/** Меряет текст под шрифт — для расчёта числа строк ДО beginCard. */
export function measureWrap(
  canvas: HTMLCanvasElement,
  text: string,
  maxW: number,
  size: number,
  weight?: 'bold',
): string[] {
  const ctx = canvas.getContext('2d')!;
  ctx.font = cardFont(size, weight);
  return wrapLines((s) => ctx.measureText(s).width, text, maxW);
}

/** Рисует обёрнутый текст, возвращает Y после последней строки. */
export function drawWrapped(
  c: Card,
  text: string,
  x: number,
  y: number,
  maxW: number,
  opts: WrapOpts,
): number {
  const base = cardFont(opts.size, opts.weight);
  c.ctx.font = opts.italic ? `italic ${base}` : base;
  c.ctx.fillStyle = opts.color;
  c.ctx.textAlign = opts.align ?? 'left';
  let lines = wrapLines((s) => c.ctx.measureText(s).width, text, maxW);
  if (opts.maxLines) lines = clampLines(lines, opts.maxLines);
  for (const line of lines) {
    c.ctx.fillText(line, x, y);
    y += opts.lineH;
  }
  c.ctx.textAlign = 'left';
  return y;
}
