// Единый центрированный диалог сайта (бэкдроп + окно) — единственная копия (правило «одна механика —
// один компонент»). Вид — классы .dialog-* из sheet-tasks.css (ds-card r20); содержимое — .dialog-title /
// .dialog-text / .dialog-actions + ds-btn. Фокус-ловушка, role="dialog", aria-modal — useDialogA11y.
// onClose — клик по бэкдропу. Не задан — окно закрывается только своими
// кнопками (выбор «ты/вы», операция «в процессе»). Escape — через общий стек
// диалогов (useDialogA11y): onEscape или closeOnEscape (тогда onClose) закрывают
// верхнее окно; без них окно держит Escape — лист под ним его не получает.
//
// Кольцо фокуса — только с клавиатуры: окно, открытое касанием или само, «тихое» до первой клавиши
// перехода (hooks/useQuietFocus.ts — та же механика у листа «Зачем это всё»).
import type { ReactNode } from 'react';
import { useDialogA11y } from '../../../shared/src/utils/dialogA11y';
import { useQuietFocus } from '../hooks/useQuietFocus';
import '../styles/sheet-tasks.css';

interface Props {
  /** Подпись окна для скринридера. */
  label: string;
  onClose?: () => void;
  closeOnEscape?: boolean;
  /** Escape без закрытия по фону (выбор формы обращения: «Позже» — тот же goBack). */
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
  const quietFocus = useQuietFocus();

  return (
    <div
      role="presentation"
      className="sk-dialog-backdrop"
      style={zIndex ? { zIndex } : undefined}
      onClick={onClose}
    >
      {underlay}
      {/* onClick — не интерактив, а stopPropagation: клик внутри окна не
          должен дойти до бэкдропа; onKeyDown — только «тихое» кольцо фокуса.
          role="dialog" не входит в список «интерактивных» ролей jsx-a11y —
          ложное срабатывание. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        {...dialogA11y}
        aria-label={label}
        className={center ? 'ds-card sk-dialog-box sk-dialog-box--center' : 'ds-card sk-dialog-box'}
        style={maxWidth ? { maxWidth } : undefined}
        data-focus={quietFocus['data-focus']}
        onKeyDown={quietFocus.onKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
