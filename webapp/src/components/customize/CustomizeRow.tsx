import type { ReactNode } from 'react';
import type { DragHandleProps } from '../../../../shared/src/hooks/useDragReorder';

interface Props {
  title: string;
  sub: string;
  /** Блок показан? undefined — у блока нет тумблера (только переставляется). */
  on?: boolean;
  onToggle?: () => void;
  /** Ручка «≡»; нет — порядок на этой раскладке не меняется. */
  handle?: DragHandleProps;
  rowRef: (el: HTMLElement | null) => void;
  offsetY: number;
  lifted: boolean;
  /** Подсветка строки: лист открыт долгим нажатием на этот блок. */
  highlighted?: boolean;
}

function Text({ title, sub }: { title: string; sub: string }) {
  return (
    <span className="cz-text">
      <span className="cz-title">{title}</span>
      <span className="cz-sub">{sub}</span>
    </span>
  );
}

// Строка блока в листе «Настроить экран» (любого экрана — «Сегодня», «Профиль», «Паттерны»): подпись + тумблер (весь ряд — это
// label тумблера, тап по тексту переключает) и ручка «≡» для перестановки.
// Тумблер — тот же .ds-switch, что в настройках и в листе «+».
export function CustomizeRow({ title, sub, on, onToggle, handle, rowRef, offsetY, lifted, highlighted }: Props) {
  const body: ReactNode = onToggle ? (
    <label className="cz-row cz-grow">
      <Text title={title} sub={sub} />
      <button type="button" role="switch" aria-checked={!!on} aria-label={title} className="ds-switch" onClick={onToggle}>
        <span className="ds-switch-knob" />
      </button>
    </label>
  ) : (
    <div className="cz-row cz-grow">
      <Text title={title} sub={sub} />
    </div>
  );
  return (
    <div
      ref={rowRef}
      className={'cz-block' + (lifted ? ' is-lifted' : '') + (highlighted ? ' is-hl' : '')}
      style={{ transform: `translateY(${offsetY}px)${lifted ? ' scale(1.02)' : ''}` }}
    >
      {body}
      {handle && (
        <div {...handle} className="cz-handle">
          <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
            <rect width="18" height="2" rx="1" fill="currentColor" />
            <rect y="6" width="18" height="2" rx="1" fill="currentColor" />
            <rect y="12" width="18" height="2" rx="1" fill="currentColor" />
          </svg>
        </div>
      )}
    </div>
  );
}
