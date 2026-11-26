// Знак «Всё по схеме» — вариант Б «Забота Здорового Взрослого» (владелец 2026-11-07,
// docs/design/PAPER_2026-11.md, «Язык знаков»): зелёная дуга-ладони держит терракотовый
// круг, за ними через всю плитку наклеена полоска шалфея. Один рисунок на все места:
// webapp/src/components/art/BrandMark.tsx (меню, вход, лендинг; цвета — токены PAPER),
// футер карточек шаринга (drawBrandMark ниже) и иконки webapp/public — favicon.svg и PNG
// пишет scripts/generate-pwa-icons.mjs из brandMarkSvg. Сверка файла favicon.svg и цветов
// со светлыми токенами index.css — webapp/src/components/art/BrandMark.test.tsx.
// Цвета здесь значениями: в canvas и в файл иконки CSS-переменная не приходит (исключение
// check-color-drift для shared/src/share/). Импортов нет и TS только стираемый: модуль
// напрямую грузит node в скрипте иконок.

/** Сторона плитки в единицах рисунка и скругление её углов. */
export const MARK_VIEW = 512;
export const TILE_RX = 112;

/** Светлая тема index.css: --bg, PAPER.sage (--c-moss 55 % на --bg), --c-moss, --c-clay. */
export const BRAND_HEX = {
  paper: '#f6f2eb',
  sage: '#aab499',
  moss: '#6b8156',
  clay: '#b06f4a',
} as const;

/** Полоска-потребность фона, сверху донизу плитки. Лежит между скруглениями углов
 *  (x 186–330 при rx 112), поэтому обрезать её по плитке не нужно. */
export const STRIPE: ReadonlyArray<readonly [number, number]> = [
  [218, 0],
  [330, 0],
  [298, 512],
  [186, 512],
];
/** Дуга-ладони: центр, радиус, толщина; разрыв 84° вверху справа. Углы в градусах
 *  по-канвасному: 0 — вправо, рост — по часовой. */
export const ARC = {
  cx: 250,
  cy: 276,
  r: 124,
  width: 70,
  from: -18,
  to: 258,
} as const;
/** Круг в ладонях — детская часть, о которой заботятся. */
export const CORE = { cx: 238, cy: 300, r: 60 } as const;

/** Посадка знака (дуга и круг) на плитке: масштаб, точка рисунка (ox, oy) встаёт в центр. */
export interface MarkFit {
  scale: number;
  ox: number;
  oy: number;
}
/** Полный — как выбрал владелец. Простой (без полоски, для 16–24 px, где она рассыпается
 *  в шум) крупнее и по центру: толще линии на мелком растре. */
export const markFit = (simple: boolean): MarkFit =>
  simple
    ? { scale: 1.18, ox: 250, oy: 278 }
    : { scale: 1.06, ox: 256, oy: 256 };
export const fitTransform = ({ scale, ox, oy }: MarkFit) =>
  `translate(256 256) scale(${scale}) translate(${-ox} ${-oy})`;

const rad = (deg: number) => (deg * Math.PI) / 180;
const fix = (v: number) => Number(v.toFixed(1));
const onArc = (deg: number) =>
  `${fix(ARC.cx + ARC.r * Math.cos(rad(deg)))} ${fix(ARC.cy + ARC.r * Math.sin(rad(deg)))}`;

export const STRIPE_D = `M${STRIPE.map(([x, y]) => `${x} ${y}`).join(' L')} Z`;
export const ARC_D = `M${onArc(ARC.from)} A${ARC.r} ${ARC.r} 0 1 1 ${onArc(ARC.to)}`;

export interface MarkOpts {
  /** Без полоски фона — для 16–24 px. */
  simple?: boolean;
  /** Квадрат без скругления: маску накладывает система (maskable, apple-touch-icon). */
  bleed?: boolean;
}

/** Файл SVG знака — favicon.svg и источник PNG-иконок. */
export function brandMarkSvg({
  simple = false,
  bleed = false,
}: MarkOpts = {}): string {
  const C = BRAND_HEX;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARK_VIEW} ${MARK_VIEW}">`,
    `  <rect width="${MARK_VIEW}" height="${MARK_VIEW}"${bleed ? '' : ` rx="${TILE_RX}"`} fill="${C.paper}"/>`,
    ...(simple ? [] : [`  <path d="${STRIPE_D}" fill="${C.sage}"/>`]),
    `  <g transform="${fitTransform(markFit(simple))}">`,
    `    <path d="${ARC_D}" fill="none" stroke="${C.moss}" stroke-width="${ARC.width}" stroke-linecap="round"/>`,
    `    <circle cx="${CORE.cx}" cy="${CORE.cy}" r="${CORE.r}" fill="${C.clay}"/>`,
    '  </g>',
    '</svg>',
    '',
  ].join('\n');
}

/** Знак на canvas: плитка size×size с левым верхним углом в (x, y). */
export function drawBrandMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  simple = false,
) {
  const k = size / MARK_VIEW;
  const fit = markFit(simple);
  const s = fit.scale * k;
  const px = (u: number) => x + (256 + (u - fit.ox) * fit.scale) * k;
  const py = (v: number) => y + (256 + (v - fit.oy) * fit.scale) * k;
  ctx.save();
  ctx.fillStyle = BRAND_HEX.paper;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, TILE_RX * k);
  ctx.fill();
  if (!simple) {
    ctx.fillStyle = BRAND_HEX.sage;
    ctx.beginPath();
    STRIPE.forEach(([sx, sy], i) => {
      if (i === 0) ctx.moveTo(x + sx * k, y + sy * k);
      else ctx.lineTo(x + sx * k, y + sy * k);
    });
    ctx.fill();
  }
  ctx.strokeStyle = BRAND_HEX.moss;
  ctx.lineWidth = ARC.width * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(px(ARC.cx), py(ARC.cy), ARC.r * s, rad(ARC.from), rad(ARC.to));
  ctx.stroke();
  ctx.fillStyle = BRAND_HEX.clay;
  ctx.beginPath();
  ctx.arc(px(CORE.cx), py(CORE.cy), CORE.r * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
