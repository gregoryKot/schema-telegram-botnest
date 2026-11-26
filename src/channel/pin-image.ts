import { createCanvas, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas';
import { join } from 'path';
import type { ChannelPost } from './channel-target';
import { pinStyle, type PinStyle } from './pin-style';
import { drawBackdrop, drawDecor, drawFrame } from './pin-draw';

/**
 * Картинка фразы для Pinterest: пин нельзя создать текстом, площадка требует
 * изображение. Формат вертикальный 2:3 — лента Pinterest режет всё остальное,
 * поэтому это не share-карточка продукта (она квадратная и живёт во
 * фронтендах, shared/src/share/cards), а самостоятельный носитель.
 *
 * Как пин выглядит — решает `pin-style` по тексту фразы: палитра, композиция,
 * фон и декор. Тут только рисование по готовому решению.
 *
 * Шрифт лежит в репозитории (assets/fonts): прод-образ node:22-slim идёт без
 * шрифтов вообще, а без кириллицы пин вышел бы из пустых прямоугольников.
 */
export const W = 1000;
export const H = 1500;
export const PAD = 90;
/** Высота подписи внизу — под неё текст не заезжает ни в одной раскладке. */
const SIGN_H = 150;

export const FONT = 'ChannelSans';

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

/**
 * Обрезка до `max` строк: последняя получает многоточие. Предел зависит от
 * кегля (он свой у каждой фразы), поэтому передаётся снаружи, а не зашит.
 */
export function clampPinLines(lines: string[], max: number): string[] {
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  kept[max - 1] = `${kept[max - 1].replace(/[\s.,;:—-]+$/, '')}…`;
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

/** Где начинается блок цитаты при выбранной раскладке. */
function blockTop(style: PinStyle, blockH: number): number {
  const top = PAD + (style.decor === 'none' ? 60 : 200);
  const bottom = H - PAD - SIGN_H;
  if (style.layout === 'bottom') return Math.max(top, bottom - blockH);
  // center, lead и frame ставят блок по центру свободного поля.
  return Math.max(top, (top + bottom - blockH) / 2);
}

/** PNG-пин с фразой. Возвращает готовые байты — их шлём в Pinterest base64. */
export function renderPhrasePin(text: string): Buffer {
  ensureFonts();
  const style = pinStyle(text);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  drawBackdrop(ctx, style);
  if (style.layout === 'frame') drawFrame(ctx, style);

  // Рамка сжимает поле, поэтому и текст в ней уже — иначе он упрётся в линию.
  const pad = style.layout === 'frame' ? PAD + 46 : PAD;
  const leadSize = Math.round(style.fontSize * 1.35);

  ctx.font = `${style.fontSize}px ${FONT}`;
  ctx.textBaseline = 'alphabetic';
  const room = H - PAD - SIGN_H - (PAD + 200);
  const lines = clampPinLines(
    wrapPinText(ctx, text, W - pad * 2),
    Math.max(3, Math.floor(room / style.lineHeight)),
  );

  // У раскладки lead первая строка крупнее: у пина появляется точка входа,
  // с которой глаз начинает читать в ленте.
  const lead = style.layout === 'lead' && lines.length > 1;
  const blockH =
    lines.length * style.lineHeight + (lead ? leadSize - style.fontSize : 0);
  let y = blockTop(style, blockH);

  // Декор при раскладке `bottom` живёт наверху, где иначе была бы пустота, а
  // не над самим текстом — иначе крупная кавычка легла бы прямо на строки.
  drawDecor(ctx, style, pad, style.layout === 'bottom' ? PAD + 300 : y);
  // Декор рисует свой крупный шрифт — возвращаем шрифт цитаты, иначе строки
  // уходят за край и наезжают друг на друга.
  ctx.font = `${style.fontSize}px ${FONT}`;
  ctx.fillStyle = `rgba(${style.palette.fg},${style.palette.dark ? 0.94 : 0.9})`;
  lines.forEach((line, i) => {
    if (lead && i === 0) {
      ctx.font = `bold ${leadSize}px ${FONT}`;
      y += leadSize - style.fontSize;
    } else if (lead && i === 1) {
      ctx.font = `${style.fontSize}px ${FONT}`;
    }
    ctx.fillText(line, pad, y);
    y += style.lineHeight;
  });

  ctx.fillStyle = style.palette.accent;
  ctx.font = `bold 34px ${FONT}`;
  ctx.fillText('Здоровый Взрослый', pad, H - PAD - 46);
  ctx.fillStyle = `rgba(${style.palette.fg},0.45)`;
  ctx.font = `30px ${FONT}`;
  ctx.fillText('schemehappens.ru', pad, H - PAD);

  return canvas.toBuffer('image/png');
}
