// Цветовые пресеты панелей редактора карты режимов
// (нода/связь). Вынесено из ModeMapNodeEditor.tsx (правило №10).

// Human-readable name for a --c-* color token, for aria-label/title on color swatches.
const COLOR_TOKEN_NAMES: Record<string, string> = {
  teal: 'Бирюзовый', rose: 'Розовый', clay: 'Терракотовый', moss: 'Оливковый',
  plum: 'Сливовый', ochre: 'Охра', slate: 'Серый', amber: 'Янтарный',
};
export const colorPresetLabel = (c: string) => {
  const m = c.match(/--c-([a-z]+)/);
  return (m && COLOR_TOKEN_NAMES[m[1]]) || 'Цвет';
};

export const COLOR_PRESETS = [
  'var(--c-teal)','var(--c-rose)','var(--c-clay)','var(--c-moss)',
  'var(--c-plum)','var(--c-ochre)','var(--c-slate)','var(--c-amber)',
];
