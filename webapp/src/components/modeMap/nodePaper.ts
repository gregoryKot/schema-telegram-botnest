import type { CSSProperties } from 'react';
import { DOMAIN_HUE, NEED_HUE } from '../../lib/tone';
import { getSchemaById } from '../../schemaTherapyData';
import { needColor } from '../../../../shared/src/needs/needColors';
import type { ModeNodeData } from './nodeStyle';

// Бумага фигуры холста (docs/design/APP_2026-11.md, b34): заливка — бумага оттенка сущности,
// контур — тот же оттенок тоном глубже, тень — сплошной сдвинутый слой. Оттенок и цвета считает
// этот файл (paperInk), CSS (.mm2-n в styles/modemap-paper.css) берёт их переменными. Режим берёт тон
// своей группы (MODE_GROUP_HUE: дети 28, критики 310, копинги 240, здоровые 145), схема — домена,
// потребность — свой; триггер — шалфей «Что случилось», поведение — солома, опыт детства — небо.
// Знаки типа (палитра, легенда) красит токен той же семьи — TYPE_COLORS в modeMapData.ts.
export const TYPE_HUE: Record<string, number> = {
  trigger: 135, child: 28, critic: 310, coping: 240, healthy: 145, custom: 195,
  behavior: 70, schema: 28, origin: 240, need: 70, needs: 70,
};

/** Цвета из «Цвет» редактора узла (COLOR_PRESETS) — те же листы бумаги, а не отдельная палитра. */
const TOKEN_HUE: Record<string, number> = {
  'var(--c-teal)': 195, 'var(--c-rose)': 25, 'var(--c-clay)': 45, 'var(--c-moss)': 145,
  'var(--c-plum)': 310, 'var(--c-ochre)': 90, 'var(--c-slate)': 240, 'var(--c-amber)': 70,
};

type PaperData = Pick<ModeNodeData, 'customColor' | 'schemaId' | 'needId'>;

/**
 * Оттенок бумаги фигуры. Схема и потребность хранят цвет домена и потребности в customColor
 * (schemaDraft, identityPick) — пока он «родной», оттенок берётся из таблицы сущности. null — цвет
 * вне палитры (старый hex сохранённой карты): бумага подмешивается из него самого (.is-own).
 */
export function nodeHue(type: string, d: PaperData): number | null {
  const c = d.customColor;
  if (type === 'schema' && d.schemaId) {
    const s = getSchemaById(d.schemaId);
    if (s && (!c || c === s.domainColor)) return DOMAIN_HUE[s.domainId] ?? TYPE_HUE.schema;
  }
  if (type === 'need' && d.needId && (!c || c === needColor(d.needId))) {
    return NEED_HUE[d.needId as keyof typeof NEED_HUE] ?? TYPE_HUE.need;
  }
  if (!c) return TYPE_HUE[type] ?? TYPE_HUE.custom;
  return TOKEN_HUE[c] ?? null;
}

const STROKE_PX: Record<string, number> = { thin: 1, normal: 1.5, bold: 3 };

export interface PaperInk { fill: string; line: string; shade: string }

// Три состояния заливки: бумага, плотнее («Заливка»), сплошной тон со светлым текстом. [L C] лица, контура и тени.
const TONES = {
  paper: ['0.915 0.03', '0.72 0.07', '0.85 0.045'],
  filled: ['0.87 0.055', '0.72 0.07', '0.79 0.06'],
  full: ['0.5 0.085', '0.42 0.085', '0.76 0.065'],
} as const;
// Доля своего цвета в лице, контуре и тени: та же бумага, подмешанная из него.
const OWN = { paper: [16, 62, 34], filled: [30, 62, 40], full: [88, 100, 40] } as const;

/**
 * Цвета фигуры готовыми значениями, без var(): экспорт картинкой (useModeMapExport, html-to-image)
 * рисует SVG-контур вне страницы, и переменные там не разрешаются — контур выходил чёрным.
 * Единственное место чисел бумаги узла: CSS (.mm2-n) только берёт --n-fill / --n-line / --n-shade.
 */
export function paperInk(hue: number | null, own: string | undefined, d: Pick<ModeNodeData, 'filled' | 'fillFull'>): PaperInk {
  const state = d.fillFull ? 'full' : d.filled ? 'filled' : 'paper';
  const [fill, line, shade] = hue === null
    ? OWN[state].map((pct) => `color-mix(in oklch, ${own} ${pct}%, white)`)
    : TONES[state].map((lc) => `oklch(${lc} ${hue})`);
  return { fill, line, shade };
}

/** Класс и переменные бумаги для корня фигуры (оттенок или свой цвет, заливка, выделение, толщина контура) и те же цвета для SVG-контура. */
export function nodePaper(type: string, d: ModeNodeData, selected?: boolean, extra = ''): { className: string; style: CSSProperties; ink: PaperInk; stroke: number } {
  const hue = nodeHue(type, d);
  const ink = paperInk(hue, d.customColor, d);
  if (selected) ink.line = 'var(--accent)';
  const stroke = STROKE_PX[d.strokeWidth ?? 'normal'] ?? 1.5;
  const vars: Record<string, string | number> = { '--n-fill': ink.fill, '--n-line': ink.line, '--n-shade': ink.shade, '--n-sw': `${stroke}px` };
  if (hue !== null) vars['--h'] = hue;
  const cls = ['mm2-n', extra, hue === null && 'is-own', d.fillFull ? 'is-full' : d.filled && 'is-filled', selected && 'is-selected'];
  return { className: cls.filter(Boolean).join(' '), style: vars as CSSProperties, ink, stroke };
}
