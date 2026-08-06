import type React from 'react';

// Стиль текстовых полей SettingsSheet. Живёт отдельно от ui.tsx: файл с
// компонентами не имеет права экспортировать константы — иначе ломается
// fast refresh (react-refresh/only-export-components), а правило №9 запрещает
// растить счётчик eslint.
export const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px',
  background: 'rgba(var(--fg-rgb),0.05)', border: '1px solid rgba(var(--fg-rgb),0.1)',
  borderRadius: 7, color: 'var(--text)', fontSize: 14, outline: 'none',
};

