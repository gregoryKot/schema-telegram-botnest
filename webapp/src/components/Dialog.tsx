// Единый центрированный диалог сайта (бэкдроп + окно) — единственная копия
// (правило «одна механика — один компонент»). Вид задают классы .dialog-* из
// index.css; содержимое собирается из .dialog-title / .dialog-text /
// .dialog-actions + .btn-primary / .btn-outline. Фокус-ловушка, role="dialog"
// и aria-modal — useDialogA11y.
//
// onClose — клик по бэкдропу. Не задан — окно закрывается только своими
// кнопками (выбор «ты/вы», операция «в процессе»). Escape слушаем только по
// closeOnEscape: окна на useHistorySheet закрывает Escape самого хука, второй
// слушатель закрыл бы их дважды.
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useDialogA11y } from '../../../shared/src/utils/dialogA11y';

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
  const dialogA11y = useDialogA11y();

  useEffect(() => {
    if (!closeOnEscape || !onClose) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeOnEscape, onClose]);

  return (
    <div
      role="presentation"
      className="dialog-backdrop"
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
        className={center ? 'dialog-box dialog-box--center' : 'dialog-box'}
        style={maxWidth ? { maxWidth } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
