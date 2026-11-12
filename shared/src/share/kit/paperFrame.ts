// Лист бумаги share-карточки (docs/design/APP_2026-11.md, b23a): цветная бумага оттенка
// сущности `oklch(0.915 0.03 h)` лежит на втором листе тоном глубже (`oklch(0.86 0.045 h)`,
// как `--pa-layer-lc` у листов сайта), сдвинутом вправо-вниз, — сплошная тень-вырезка без blur
// и градиентов. Под листом — бумага страницы (--bg). oklch канвасу отдаём значением sRGB
// (oklchHex): старые webview мессенджеров не разбирают oklch() в fillStyle.
import { oklchHex } from '../../theme/entityHue';
import { PAPER_HUE } from '../../theme/signKeys';
import { INK, inkOf } from './ink';
import { nearestHue, oklchHue } from './color';
import { SANS, SERIF } from './theme';

/** Бумага листа (.pp-paper). */
export const paperHex = (h: number) => oklchHex(0.915, 0.03, h);
/** Второй лист под ним — тень-вырезка (--pa-layer-lc). */
export const layerHex = (h: number) => oklchHex(0.86, 0.045, h);
/** Тон бумаги глубже: пустая клетка, паз столбика. */
export const sunkHex = (h: number) => oklchHex(0.87, 0.035, h);
/** Силуэт знака на тихой бумаге (неполученный значок): один тон, заметно глубже паза. */
export const silhouetteHex = (h: number) => oklchHex(0.79, 0.03, h);
/** Читаемые чернила оттенка листа: эйбрау, числа, номера шагов (≥4.5:1 к бумаге). */
export const hueInkHex = (h: number) => oklchHex(0.42, 0.08, h);

/** Где лежит лист внутри канваса: отступ от края и сдвиг второго листа. */
export const SHEET = { x: 12, y: 12, dx: 6, dy: 7, r: 22 } as const;

/** Прямоугольник лицевого листа для канваса W×H. */
export function sheetRect(W: number, H: number) {
  return {
    x: SHEET.x,
    y: SHEET.y,
    w: W - SHEET.x * 2 - SHEET.dx,
    h: H - SHEET.y * 2 - SHEET.dy,
  };
}

const HUES = Object.values(PAPER_HUE) as number[];

/**
 * Бумага по цвету сущности, который передают старые вызовы ('var(--c-rose)', '#hex' группы
 * режима): ближайший оттенок бумаги. Неизвестный или серый цвет — небо (240), как «Мой путь».
 */
export function hueFromColor(color: string | undefined): number {
  const h = color ? oklchHue(inkOf(color)) : null;
  return h === null ? 240 : nearestHue(h, HUES);
}

/** Страница, второй лист и лицевой лист оттенка h. */
export function paintSheet(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  h: number,
) {
  const s = sheetRect(W, H);
  ctx.fillStyle = INK.page;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = layerHex(h);
  ctx.beginPath();
  ctx.roundRect(s.x + SHEET.dx, s.y + SHEET.dy, s.w, s.h, SHEET.r);
  ctx.fill();
  ctx.fillStyle = paperHex(h);
  ctx.beginPath();
  ctx.roundRect(s.x, s.y, s.w, s.h, SHEET.r);
  ctx.fill();
}

let fontsReady: Promise<boolean> | null = null;

/**
 * Literata и Manrope для канваса: их @font-face объявляет сайт, но браузер грузит шрифт только
 * под текст в DOM, а canvas без загруженного шрифта молча рисует Georgia. Ждём не дольше
 * `timeoutMs`; true — шрифты на месте и карточку стоит перерисовать.
 */
export function loadCardFonts(timeoutMs = 1500): Promise<boolean> {
  if (fontsReady) return fontsReady;
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  if (!fonts?.load) return Promise.resolve(false);
  const faces = [`20px ${SERIF}`, `bold 20px ${SANS}`, `20px ${SANS}`];
  const load = Promise.all(faces.map((f) => fonts.load(f, 'Ая'))).then(
    (list) => list.some((l) => l.length > 0),
    () => false,
  );
  const timeout = new Promise<boolean>((r) =>
    setTimeout(() => r(false), timeoutMs),
  );
  fontsReady = Promise.race([load, timeout]).then((ok) => {
    if (!ok) fontsReady = null; // не дождались — следующая карточка попробует снова
    return ok;
  });
  return fontsReady;
}

/** Только для тестов: сбросить запомненную загрузку шрифтов. */
export function resetCardFontsForTest() {
  fontsReady = null;
}
