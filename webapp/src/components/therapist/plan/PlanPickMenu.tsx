import { useRef, type ReactNode } from 'react';
import { Dropdown } from '../../Dropdown';
import { useMenuPick } from '../../useMenuPick';

export interface PickOption<T> { value: T; label: string }

interface Props<T> {
  options: PickOption<T>[];
  /** Отмеченный вариант (menuitemradio). */
  current: T;
  onPick: (value: T) => void;
  /** Подпись меню для скринридера. */
  label: string;
  className: string;
  disabled?: boolean;
  /** Содержимое кнопки-якоря. */
  children: ReactNode;
}

/** Меню выбора одного из вариантов у кнопки (статус пункта, «В фазу…»): тот же Dropdown, что у «⋯». */
export function PlanPickMenu<T extends string | number | null>({ options, current, onPick, label, className, disabled, children }: Props<T>) {
  const { open, setOpen, btnRef, pick } = useMenuPick();
  const wrapRef = useRef<HTMLSpanElement>(null);
  return (
    <span ref={wrapRef} className="pl-menu-anchor">
      <button
        ref={btnRef} type="button" className={className} disabled={disabled} aria-label={label}
        aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
      >
        {children}
      </button>
      {open && (
        <Dropdown anchorRef={wrapRef} onClose={() => setOpen(false)} role="menu" label={label} portal>
          {options.map((o) => (
            <button
              key={String(o.value)} type="button" role="menuitemradio" aria-checked={o.value === current}
              className={`ds-menu-item pl-menu-item${o.value === current ? ' is-current' : ''}`} onClick={pick(() => onPick(o.value))}
            >
              <span className="pl-menu-mark" aria-hidden>{o.value === current ? '✓' : ''}</span>{o.label}
            </button>
          ))}
        </Dropdown>
      )}
    </span>
  );
}
