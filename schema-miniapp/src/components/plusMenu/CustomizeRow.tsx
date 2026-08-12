import { ToggleRow } from '../todayCustomize/ToggleRow';
import { DragHandle } from './DragHandle';
import type { DragHandleProps } from '../../hooks/useDragReorder';

// Строка листа настройки: ToggleRow (скрыть/показать) + ручка «≡» (порядок,
// DragHandle — место MoveArrows, удалённого правилом №11).
export function CustomizeRow({
  label,
  sub,
  hidden,
  onToggle,
  dragHandleProps,
  rowRef,
  drag: { offsetY, lifted },
  highlighted,
}: {
  label: string;
  sub: string;
  hidden: boolean;
  onToggle: () => void;
  dragHandleProps: DragHandleProps;
  rowRef: (el: HTMLElement | null) => void;
  drag: { offsetY: number; lifted: boolean };
  highlighted?: boolean;
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
          on={!hidden}
          onToggle={onToggle}
          highlighted={highlighted}
        />
      </div>
      <DragHandle {...dragHandleProps} />
    </div>
  );
}
