// Общие стили и цветовые пресеты панелей редактора карты режимов
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

// Хитбокс ≥32px (аудит 2026-08, К3): padding расширяет тач-зону, отрицательный
// margin возвращает вклад в раскладку к прежним 2px/4px — визуально кнопка
// (без фона/рамки, только иконка) не меняется.
export const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)',
  fontSize: 13, padding: '9px', margin: '-7px -5px', lineHeight: 1,
};

export const panelStyle: React.CSSProperties = {
  width: 230, flexShrink: 0,
  borderLeft: '1px solid var(--line)',
  padding: '16px 14px', overflowY: 'auto',
  background: 'var(--surface-2)',
  display: 'flex', flexDirection: 'column',
};
export const labelStyle: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.05em', color: 'var(--text-faint)', marginBottom: 5, display: 'block',
};
export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 'var(--r-6)',
  border: '1px solid var(--line-strong)',
  background: 'var(--bg-elev)', color: 'var(--text)',
  fontSize: 13, marginBottom: 14, boxSizing: 'border-box', outline: 'none',
};
export const deleteBtnStyle: React.CSSProperties = {
  marginTop: 'auto', padding: '8px 12px', borderRadius: 'var(--r-6)',
  border: '1px solid var(--line)',
  background: 'none', color: 'var(--accent-red)', fontSize: 12.5, cursor: 'pointer',
};
