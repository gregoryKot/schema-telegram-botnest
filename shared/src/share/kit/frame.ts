// Рамка share-карточки: фон со свечением, шапка (эйбрау → заголовок →
// подпись), плашки-панели и брендовый футер. Всё, что делает карточку
// «карточкой», живёт здесь — сами карточки только раскладывают содержимое.
import {
  CARD_PAD,
  CARD_W,
  DPR,
  cardFont,
  resolveCardTheme,
  withAlpha,
  type CardTheme,
} from './theme';
import { clampLines, wrapLines } from './text';

export interface Card {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  th: CardTheme;
  /** Цвет карточки: эйбрау, свечение фона, акценты содержимого. */
  accent: string;
  /** Второй цвет градиентов (по умолчанию — акцент темы). */
  accent2: string;
}

/** Высота футера с отступом — карточки закладывают её в расчёт высоты. */
export const FOOTER_H = 62;

export interface CardOpts {
  /** Основной цвет карточки ('#hex' или 'var(--accent-blue)'). */
  accent?: string;
  /** Второй цвет для градиентов фона и брендовой метки. */
  accent2?: string;
}

/** Межбуквенный интервал (в браузерах без поддержки — молча игнорируется). */
export function tracking(ctx: CanvasRenderingContext2D, px: number) {
  (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
}

/** Настраивает канвас (DPR, фон со свечением, рамка) и возвращает контекст. */
export function beginCard(
  canvas: HTMLCanvasElement,
  H: number,
  opts: CardOpts = {},
): Card {
  const W = CARD_W;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  const th = resolveCardTheme();
  const accent = th.color(opts.accent ?? th.accent);
  const accent2 = th.color(opts.accent2 ?? th.accent);
  const c: Card = { ctx, W, H, th, accent, accent2 };

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 26);
  ctx.clip();

  const base = ctx.createLinearGradient(0, 0, W * 0.4, H);
  base.addColorStop(0, th.sheetBg);
  base.addColorStop(1, th.bg);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // Два мягких свечения цветами карточки: сверху — «рассвет», снизу — отблеск.
  const glowTop = ctx.createRadialGradient(W * 0.72, -40, 0, W * 0.72, -40, W);
  glowTop.addColorStop(0, withAlpha(accent, th.isLight ? 0.3 : 0.42));
  glowTop.addColorStop(1, withAlpha(accent, 0));
  ctx.fillStyle = glowTop;
  ctx.fillRect(0, 0, W, Math.min(H, 320));

  const glowBottom = ctx.createRadialGradient(0, H, 0, 0, H, W * 0.9);
  glowBottom.addColorStop(0, withAlpha(accent2, th.isLight ? 0.16 : 0.2));
  glowBottom.addColorStop(1, withAlpha(accent2, 0));
  ctx.fillStyle = glowBottom;
  ctx.fillRect(0, Math.max(0, H - 320), W, Math.min(H, 320));
  ctx.restore();

  // Тонкая рамка — карточка не сливается с фоном мессенджера
  ctx.strokeStyle = th.fg(th.isLight ? 0.1 : 0.12);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, W - 1, H - 1, 26);
  ctx.stroke();

  return c;
}

/** Полупрозрачная плашка под блок содержимого. */
export function panel(
  c: Card,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 18,
) {
  const { ctx, th } = c;
  ctx.fillStyle = th.fg(th.isLight ? 0.045 : 0.05);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.strokeStyle = th.fg(th.isLight ? 0.07 : 0.07);
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function divider(c: Card, y: number, alpha = 0.08) {
  c.ctx.strokeStyle = c.th.fg(alpha);
  c.ctx.lineWidth = 1;
  c.ctx.beginPath();
  c.ctx.moveTo(CARD_PAD, y);
  c.ctx.lineTo(c.W - CARD_PAD, y);
  c.ctx.stroke();
}

/** Мелкая подпись-рубрика над блоком («ОЦЕНКИ ДНЯ»). Возвращает Y под ней. */
export function sectionLabel(
  c: Card,
  text: string,
  y: number,
  color?: string,
): number {
  const { ctx } = c;
  ctx.font = cardFont(10, 'bold');
  ctx.fillStyle = color ?? c.th.fg(0.38);
  ctx.textAlign = 'left';
  tracking(ctx, 0.9);
  ctx.fillText(text.toUpperCase(), CARD_PAD, y);
  tracking(ctx, 0);
  return y + 18;
}

export interface HeaderOpts {
  /** Рубрика над заголовком — цветом карточки. */
  eyebrow?: string;
  title: string;
  subtitle?: string;
}

/** Высота шапки от верха карточки — чистая (нужна для расчёта высоты). */
export function headerHeight(titleLines: number, subtitle?: boolean): number {
  return 62 + titleLines * 29 + (subtitle ? 22 : 0) + 14;
}

/** Шапка: рубрика с точкой, заголовок (до 2 строк), подпись. Возвращает Y. */
export function header(c: Card, o: HeaderOpts): number {
  const { ctx, th } = c;
  const maxW = c.W - CARD_PAD * 2;
  let y = 0;

  if (o.eyebrow) {
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.arc(CARD_PAD + 3, 43, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = cardFont(10, 'bold');
    ctx.textAlign = 'left';
    tracking(ctx, 1);
    ctx.fillText(o.eyebrow.toUpperCase(), CARD_PAD + 14, 47);
    tracking(ctx, 0);
  }

  ctx.font = cardFont(23, 'bold');
  const lines = clampLines(
    wrapLines((s) => ctx.measureText(s).width, o.title, maxW),
    2,
  );
  y = o.eyebrow ? 80 : 58;
  for (const line of lines) {
    ctx.fillStyle = th.fg(0.96);
    ctx.font = cardFont(23, 'bold');
    ctx.fillText(line, CARD_PAD, y);
    y += 29;
  }

  if (o.subtitle) {
    ctx.font = cardFont(12.5);
    ctx.fillStyle = th.fg(0.44);
    ctx.fillText(o.subtitle, CARD_PAD, y - 4);
    y += 18;
  }
  return y + 14;
}

// Канал проекта — брендовая подпись карточек (захардкожен по всему проекту).
// Бот-ссылка в текст шаринга идёт отдельно через botShortUrl каждого фронта.
const BRAND = '@SchemeHappens';

/** Футер: брендовая метка со ссылкой слева, подпись карточки справа. */
export function footer(c: Card, label: string) {
  const { ctx, th } = c;
  const y = c.H - 38;

  divider(c, y - 24, 0.07);

  const grad = ctx.createLinearGradient(CARD_PAD, y - 13, CARD_PAD + 20, y + 5);
  grad.addColorStop(0, c.accent);
  grad.addColorStop(1, c.accent2);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(CARD_PAD, y - 13, 20, 20, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(CARD_PAD + 10, y - 3, 3.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = cardFont(11.5, 'bold');
  ctx.fillStyle = th.fg(0.5);
  ctx.textAlign = 'left';
  ctx.fillText(BRAND, CARD_PAD + 28, y + 1);

  ctx.font = cardFont(11);
  ctx.fillStyle = th.fg(0.32);
  ctx.textAlign = 'right';
  ctx.fillText(label, c.W - CARD_PAD, y + 1);
  ctx.textAlign = 'left';
}
