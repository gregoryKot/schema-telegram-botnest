import { ToggleRow } from '../todayCustomize/ToggleRow';
import { DragHandle } from './DragHandle';
import type { DragHandleProps } from '../../hooks/useDragReorder';

// Строка листа настройки: ToggleRow (скрыть/показать) + ручка «≡» (порядок,
// DragHandle — место MoveArrows, удалённого правилом №11). Без onToggle —
// строка без свитча (блок только переставляется, не скрывается); divider —
// для строк внутри iOS-группы-карточки («Сегодня»).
export function CustomizeRow({
  label,
  sub,
  hidden,
  onToggle,
  dragHandleProps,
  rowRef,
  drag: { offsetY, lifted },
  highlighted,
  divider,
}: {
  label: string;
  sub: string;
  hidden?: boolean;
  onToggle?: () => void;
  dragHandleProps: DragHandleProps;
  rowRef: (el: HTMLElement | null) => void;
  drag: { offsetY: number; lifted: boolean };
  highlighted?: boolean;
  divider?: boolean;
}) {
  return (
    <div
      ref={rowRef}
      style={{
        display: 'flex',
        gap: 4,
        transform: `translateY(${offsetY}px)${lifted ? ' scale(1.02)' : ''}`,
        transition: lifted ? 'none' : 'transform 150ms ease',
        boxShadow: lifted ? '0 8px 24px rgba(var(--fg-rgb),0.18)' : undefined,
        zIndex: lifted ? 1 : undefined,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <ToggleRow
          title={label}
          sub={sub}
          on={onToggle ? !hidden : undefined}
          onToggle={onToggle}
          highlighted={highlighted}
          divider={divider}
        />
      </div>
      <DragHandle {...dragHandleProps} />
    </div>
  );
}
