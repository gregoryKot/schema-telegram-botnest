// Единый центрированный диалог сайта (бэкдроп + окно) — единственная копия
// (правило «одна механика — один компонент»). Вид задают классы .dialog-* из
// sheet-tasks.css (ds-card r20); содержимое — .dialog-title / .dialog-text /
// .dialog-actions + ds-btn. Фокус-ловушка, role="dialog", aria-modal — useDialogA11y.
//
// onClose — клик по бэкдропу. Не задан — окно закрывается только своими
// кнопками (выбор «ты/вы», операция «в процессе»). Escape — через общий стек
// диалогов (useDialogA11y) и только по closeOnEscape: закрывается верхнее
// окно, а useHistorySheet под ним такое событие пропускает.
import type { ReactNode } from 'react';
import { useDialogA11y } from '../../../shared/src/utils/dialogA11y';
import '../styles/sheet-tasks.css';

interface Props {
  /** Подпись окна для скринридера. */
  label: string;
  onClose?: () => void;
  closeOnEscape?: boolean;
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
  zIndex,
  maxWidth,
  center = false,
  underlay,
  children,
}: Props) {
  const dialogA11y = useDialogA11y({
    onEscape: closeOnEscape ? onClose : undefined,
  });

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
