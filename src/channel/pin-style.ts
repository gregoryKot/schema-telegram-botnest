import { pickIndex } from '../utils/hash';

/**
 * Оформление пина Pinterest: палитра, композиция, фон, декор.
 *
 * Лента Pinterest — это витрина превью, и двадцать одинаковых тёмных
 * прямоугольников подряд читаются как один пин, показанный двадцать раз.
 * Поэтому каждая фраза получает свой вид.
 *
 * Вид выбирается ИЗ ТЕКСТА фразы, а не случайно: одна и та же фраза всегда
 * выглядит одинаково. Это важно для повторной отправки (ретрай не создаст
 * второй непохожий пин), для тестов и для проверки `/zv pinterest` — она
 * показывает ровно то, что уйдёт в бою. Грани независимы: палитра, композиция,
 * фон и декор берут разные срезы хэша, поэтому сочетаний сотни, а не десяток
 * заранее нарисованных шаблонов.
 */

export interface PinPalette {
  /** Имя — для тестов и отладки, в картинку не попадает. */
  name: string;
  bg: string;
  bgTo: string;
  /** Цвет текста как «r, g, b» — прозрачность задаётся на месте. */
  fg: string;
  accent: string;
  /** Тёмная палитра или светлая: от этого зависит сила декора. */
  dark: boolean;
}

/**
 * Палитры. Тёмных больше — канал про вечернюю тишину, а не про яркость, но
 * светлые нужны: в ленте они дают паузу и не сливаются в одно пятно.
 */
export const PALETTES: PinPalette[] = [
  {
    name: 'ночь',
    bg: '#191b25',
    bgTo: '#23252f',
    fg: '255, 255, 255',
    accent: '#8f86ff',
    dark: true,
  },
  {
    name: 'индиго',
    bg: '#161a33',
    bgTo: '#252a52',
    fg: '255, 255, 255',
    accent: '#a5b4ff',
    dark: true,
  },
  {
    name: 'мох',
    bg: '#141f19',
    bgTo: '#1e3227',
    fg: '255, 255, 255',
    accent: '#7fd6a3',
    dark: true,
  },
  {
    name: 'терракота',
    bg: '#241a16',
    bgTo: '#35251d',
    fg: '255, 255, 255',
    accent: '#f0a17a',
    dark: true,
  },
  {
    name: 'слива',
    bg: '#211626',
    bgTo: '#33223a',
    fg: '255, 255, 255',
    accent: '#d59bff',
    dark: true,
  },
  {
    name: 'море',
    bg: '#0f2129',
    bgTo: '#16323f',
    fg: '255, 255, 255',
    accent: '#6fd0e8',
    dark: true,
  },
  {
    name: 'уголь',
    bg: '#131418',
    bgTo: '#1e2027',
    fg: '255, 255, 255',
    accent: '#ffd479',
    dark: true,
  },
  {
    name: 'вишня',
    bg: '#241419',
    bgTo: '#361d26',
    fg: '255, 255, 255',
    accent: '#ff9fb0',
    dark: true,
  },
  {
    name: 'песок',
    bg: '#f3ece2',
    bgTo: '#e6d9c8',
    fg: '38, 30, 24',
    accent: '#9a5f38',
    dark: false,
  },
  {
    name: 'бумага',
    bg: '#f5f4f0',
    bgTo: '#e9e7e0',
    fg: '30, 32, 40',
    accent: '#5b56b8',
    dark: false,
  },
  {
    name: 'мята',
    bg: '#eaf3ee',
    bgTo: '#d9ece2',
    fg: '18, 43, 33',
    accent: '#2f7d5a',
    dark: false,
  },
  {
    name: 'небо',
    bg: '#eef2f8',
    bgTo: '#dde6f3',
    fg: '22, 32, 48',
    accent: '#3a6ea8',
    dark: false,
  },
];

/** Куда прижат текст и как ведёт себя первая строка. */
export type PinLayout = 'center' | 'bottom' | 'lead' | 'frame';
export const LAYOUTS: PinLayout[] = ['center', 'bottom', 'lead', 'frame'];

/** Форма фона: заливка сверху вниз, по диагонали или мягкое пятно света. */
export type PinBackdrop = 'vertical' | 'diagonal' | 'glow';
export const BACKDROPS: PinBackdrop[] = ['vertical', 'diagonal', 'glow'];

/** Угол, в котором живёт пятно света или декор. */
export type PinCorner = 'tl' | 'tr' | 'bl' | 'br';
export const CORNERS: PinCorner[] = ['tl', 'tr', 'bl', 'br'];

/** Знак у цитаты: кавычка, точка, черта или ничего. */
export type PinDecor = 'quote' | 'dot' | 'rule' | 'none';
export const DECORS: PinDecor[] = ['quote', 'dot', 'rule', 'none'];

export interface PinStyle {
  palette: PinPalette;
  layout: PinLayout;
  backdrop: PinBackdrop;
  corner: PinCorner;
  decor: PinDecor;
  /** Кегль цитаты и высота строки — считаются от длины фразы. */
  fontSize: number;
  lineHeight: number;
}

/**
 * Кегль от длины: короткая фраза, набранная мелко, висит посреди пустого пина,
 * а длинная крупным кеглем не влезает и обрезается многоточием. Ступени
 * подобраны так, чтобы текст занимал сопоставимую площадь при любой длине.
 */
export function sizeForLength(length: number): {
  fontSize: number;
  lineHeight: number;
} {
  if (length <= 60) return { fontSize: 82, lineHeight: 114 };
  if (length <= 110) return { fontSize: 70, lineHeight: 98 };
  if (length <= 190) return { fontSize: 60, lineHeight: 86 };
  if (length <= 300) return { fontSize: 52, lineHeight: 74 };
  return { fontSize: 44, lineHeight: 64 };
}

/** Оформление для фразы: стабильное для одного текста, разное для разных. */
export function pinStyle(text: string): PinStyle {
  return {
    palette: PALETTES[pickIndex(text, 'palette', PALETTES.length)],
    layout: LAYOUTS[pickIndex(text, 'layout', LAYOUTS.length)],
    backdrop: BACKDROPS[pickIndex(text, 'backdrop', BACKDROPS.length)],
    corner: CORNERS[pickIndex(text, 'corner', CORNERS.length)],
    decor: DECORS[pickIndex(text, 'decor', DECORS.length)],
    ...sizeForLength(text.length),
  };
}
