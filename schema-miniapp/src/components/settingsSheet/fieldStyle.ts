// Общий вид полей анкеты «Стать специалистом» (input и textarea). Отдельным
// файлом: в файле с компонентом экспорт константы ломает fast refresh
// (react-refresh/only-export-components), а в самом компоненте он занимал бы
// строки, которых у файла нет (потолок размера, правило №10).
export const FIELD_STYLE = {
  width: '100%',
  background: 'rgba(var(--fg-rgb),0.06)',
  border: '1px solid rgba(var(--fg-rgb),0.12)',
  borderRadius: 10,
  padding: '9px 12px',
  color: 'var(--text)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
} as const;
