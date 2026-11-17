// Сетка ×2: враг растёт и мельчает ступенями, а не дробным масштабом — пиксели остаются ровными.
export const GRID = 2;

// Масштаб спрайта для «размера» врага: целое число экранных пикселей на пиксель арта.
export const gridScale = (size: number) => Math.max(1, Math.round(GRID * size));

// Тревога нарисована в трёх размерах: после удара делится на малые, рядом с критиком вырастает.
export type AnxTier = 's' | 'm' | 'l';
export const anxTier = (size: number): AnxTier => (size < 0.8 ? 's' : size < 1.4 ? 'm' : 'l');
