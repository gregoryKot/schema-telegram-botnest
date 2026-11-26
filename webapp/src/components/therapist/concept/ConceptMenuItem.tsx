import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { MMIcon, type IconName } from '../../modeMapIcons';

// Пункт меню «Ещё» вкладки «Концептуализация»: слева иконка действия (SVG, не глиф — принцип 7), название, под
// ним — подсказка строкой (видна без hover, в отличие от title). Имя пункта для ридера и тестов — только
// название (aria-labelledby), подсказка — его описание.
export function ConceptMenuItem({ icon, hint, children, ...rest }: { icon: IconName; hint?: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const id = useId();
  return (
    <button type="button" role="menuitem" className="ds-menu-item" aria-labelledby={`${id}-l`} aria-describedby={hint ? `${id}-h` : undefined} {...rest}>
      <MMIcon name={icon} size={16} className="tcp-menu-icon" />
      <span className="tcp-menu-text">
        <span id={`${id}-l`}>{children}</span>
        {hint && <span id={`${id}-h`} className="tcp-menu-hint">{hint}</span>}
      </span>
    </button>
  );
}
