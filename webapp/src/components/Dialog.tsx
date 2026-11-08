// Единый центрированный диалог сайта (бэкдроп + окно) — единственная копия (правило «одна механика —
// один компонент»). Вид — классы .dialog-* из sheet-tasks.css (ds-card r20); содержимое — .dialog-title /
// .dialog-text / .dialog-actions + ds-btn. Фокус-ловушка, role="dialog", aria-modal — useDialogA11y.
// onClose — клик по бэкдропу. Не задан — окно закрывается только своими
// кнопками (выбор «ты/вы», операция «в процессе»). Escape — через общий стек
// диалогов (useDialogA11y): onEscape или closeOnEscape (тогда onClose) закрывают
// верхнее окно; без них окно держит Escape — лист под ним его не получает.
import type { ReactNode } from 'react';
import { useDialogA11y } from '../../../shared/src/utils/dialogA11y';
import '../styles/sheet-tasks.css';

interface Props {
  /** Подпись окна для скринридера. */
  label: string;
  onClose?: () => void;
  closeOnEscape?: boolean;
  /** Escape без закрытия по фону (выбор «ты/вы»: «Позже» — тот же goBack). */
  onEscape?: () => void;
  zIndex?: number;
  maxWidth?: number;
  center?: boolean;
  /** Слой под окном, поверх затемнения (конфетти). */
  underlay?: ReactNode;
  children: ReactNode;
}

export function Dialog({
  label,
  onClose,
  closeOnEscape = false,
  onEscape,
  zIndex,
  maxWidth,
  center = false,
  underlay,
  children,
}: Props) {
  const dialogA11y = useDialogA11y({ onEscape: onEscape ?? (closeOnEscape ? onClose : undefined), holdEscape: true });

  return (
    <div
      role="presentation"
      className="sk-dialog-backdrop"
      style={zIndex ? { zIndex } : undefined}
      onClick={onClose}
    >
      {underlay}
      {/* onClick — не интерактив, а stopPropagation: клик внутри окна не
          должен дойти до бэкдропа. role="dialog" не входит в список
          «интерактивных» ролей jsx-a11y — ложное срабатывание на паре. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        {...dialogA11y}
        aria-label={label}
        className={center ? 'ds-card sk-dialog-box sk-dialog-box--center' : 'ds-card sk-dialog-box'}
        style={maxWidth ? { maxWidth } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
