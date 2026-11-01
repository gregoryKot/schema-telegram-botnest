import type { ReactNode } from 'react';

// Галочка «я понимаю, что …» перед необратимым переносом аккаунта. Одна на
// оба экрана с этим эффектом — объединение по ссылке (MergePage) и привязка
// мессенджера по коду (LinkDevicePage): кнопка подтверждения недоступна, пока
// галочка не стоит. Зона нажатия — вся строка (`.as-check`, min-height 44px).
export function AckCheck({
  checked,
  onChange,
  disabled,
  children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="as-check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>{children}</span>
    </label>
  );
}
