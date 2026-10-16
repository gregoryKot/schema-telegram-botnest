// Строка пункта палитры карты режимов — общая у режимов и у секции «Схема случая».
export const paletteItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 'var(--space-8)',
  width: '100%', padding: '6px 14px',
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text)', textAlign: 'left', outline: 'none',
};

// Кнопка-«ушко» сворачивания боковой панели редактора карты (палитра слева, правка справа).
export function collapseBtnStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute', top: 8, [side === 'left' ? 'right' : 'left']: -11, zIndex: 6,
    width: 22, height: 22, borderRadius: '50%', border: '1px solid rgba(var(--fg-rgb),0.15)',
    background: 'var(--bg-elev)', color: 'var(--text-sub)', cursor: 'pointer', fontSize: 13, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
  };
}
