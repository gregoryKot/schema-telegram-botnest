import { createCanvas, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas';
import { join } from 'path';
import type { ChannelPost } from './channel-target';

/**
 * Картинка фразы для Pinterest: пин нельзя создать текстом, площадка требует
 * изображение. Формат вертикальный 2:3 — лента Pinterest режет всё остальное,
 * поэтому это не share-карточка продукта (она квадратная и живёт во
 * фронтендах, shared/src/share/cards), а самостоятельный носитель. Общее у них
 * только палитра — константы ниже совпадают с тёмной темой карточек.
 *
 * Шрифт лежит в репозитории (assets/fonts): прод-образ node:22-slim идёт без
 * шрифтов вообще, а без кириллицы пин вышел бы из пустых прямоугольников.
 */
const W = 1000;
const H = 1500;
const PAD = 90;

const BG = '#191b25';
const BG_GLOW = '#23252f';
const FG = '255, 255, 255';
const ACCENT = '#8f86ff';

const FONT = 'ChannelSans';
const QUOTE_SIZE = 58;
const QUOTE_LINE_H = 86;
/** Больше не влезает по высоте — длинные фразы обрезаются многоточием. */
const MAX_LINES = 11;

let fontsReady = false;

/** Шрифты регистрируются один раз на процесс: разбор ttf не бесплатный. */
function ensureFonts(): void {
  if (fontsReady) return;
  const dir = join(process.cwd(), 'assets', 'fonts');
  GlobalFonts.registerFromPath(join(dir, 'LiberationSans-Regular.ttf'), FONT);
  GlobalFonts.registerFromPath(join(dir, 'LiberationSans-Bold.ttf'), FONT);
  fontsReady = true;
}

/** Перенос по словам под ширину maxW; длинное слово рвётся по символам. */
export function wrapPinText(
  ctx: SKRSContext2D,
  text: string,
  maxW: number,
): string[] {
  const lines: string[] = [];
  let line = '';
  const push = () => {
    if (line) lines.push(line);
    line = '';
  };
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxW) {
      line = candidate;
      continue;
    }
    push();
    if (ctx.measureText(word).width <= maxW) {
      line = word;
      continue;
    }
    // Слово шире строки (ссылка, длинное составное) — рвём по символам.
    let chunk = '';
    for (const ch of word) {
      if (ctx.measureText(chunk + ch).width > maxW) {
        lines.push(chunk);
        chunk = ch;
      } else chunk += ch;
    }
    line = chunk;
  }
  push();
  return lines;
}

/** Обрезка до MAX_LINES: последняя строка получает многоточие. */
export function clampPinLines(lines: string[]): string[] {
  if (lines.length <= MAX_LINES) return lines;
  const kept = lines.slice(0, MAX_LINES);
  kept[MAX_LINES - 1] = `${kept[MAX_LINES - 1].replace(/[\s.,;:—-]+$/, '')}…`;
  return kept;
}

/**
 * Пост для рассылки: картинка считается лениво и один раз на публикацию —
 * рендер стоит десятки миллисекунд и нужен только Pinterest.
 */
export function makeChannelPost(text: string): ChannelPost {
  let cached: Promise<Buffer> | null = null;
  return {
    text,
    image: () =>
      (cached ??= Promise.resolve().then(() => renderPhrasePin(text))),
  };
}

/** PNG-пин с фразой. Возвращает готовые байты — их шлём в Pinterest base64. */
export function renderPhrasePin(text: string): Buffer {
  ensureFonts();
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  // Мягкое свечение сверху — карточка не выглядит плоским прямоугольником.
  const glow = ctx.createLinearGradient(0, 0, 0, H);
  glow.addColorStop(0, BG_GLOW);
  glow.addColorStop(1, BG);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  // Декоративная кавычка задаёт настроение и отделяет цитату от подписи.
  ctx.fillStyle = `rgba(${FG},0.14)`;
  ctx.font = `bold 220px ${FONT}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('«', PAD - 10, PAD + 190);

  ctx.font = `${QUOTE_SIZE}px ${FONT}`;
  const lines = clampPinLines(wrapPinText(ctx, text, W - PAD * 2));
  const blockH = lines.length * QUOTE_LINE_H;
  let y = Math.max(PAD + 300, (H - blockH) / 2);
  ctx.fillStyle = `rgba(${FG},0.94)`;
  for (const line of lines) {
    ctx.fillText(line, PAD, y);
    y += QUOTE_LINE_H;
  }

  ctx.fillStyle = ACCENT;
  ctx.font = `bold 34px ${FONT}`;
  ctx.fillText('Здоровый Взрослый', PAD, H - PAD - 46);
  ctx.fillStyle = `rgba(${FG},0.45)`;
  ctx.font = `30px ${FONT}`;
  ctx.fillText('schemehappens.ru', PAD, H - PAD);

  return canvas.toBuffer('image/png');
}
