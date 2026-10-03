// Оболочка «лист снизу» (бэкдроп + карточка + полоска-хват) — единственная
// копия для webapp (правило «одна механика — один компонент»). Вид задают
// классы .sheet-modal* из index.css: на телефоне лист снизу, на десктопе —
// окно по центру (ровно как InfoModal настроек). Раньше стили были инлайном
// и на десктопе шторка висела внизу, как мобильная вставка в editorial-сайте.
// goBack — уже посчитанный вызывающим через useHistorySheet (не считаем
// здесь: у каждого владельца свой единственный вызов хука истории).
import type { ReactNode } from 'react';
import { useDialogA11y } from '../../../shared/src/utils/dialogA11y';

interface Props {
  goBack: () => void;
  zIndex: number;
  /** Узкая шторка (по умолчанию ширину задаёт класс). */
  maxWidth?: number;
  /** Подпись окна для скринридера. */
  label?: string;
  children: ReactNode;
}

export function BottomSheetShell({
  goBack,
  zIndex,
  maxWidth,
  label,
  children,
}: Props) {
  const dialogA11y = useDialogA11y();
  return (
    <div
      role="presentation"
      className="sheet-modal"
      style={{ zIndex }}
      onClick={goBack}
    >
      {/* onClick — не интерактив, а stopPropagation: клик внутри окна не
          должен дойти до бэкдропа. role="dialog" не входит в список
          «интерактивных» ролей jsx-a11y — ложное срабатывание. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        {...dialogA11y}
        aria-label={label}
        className="sheet-modal-box"
        style={maxWidth ? { maxWidth } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-modal-handle" />
        {children}
      </div>
    </div>
  );
}
