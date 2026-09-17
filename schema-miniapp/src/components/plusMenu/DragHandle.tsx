import type { DragHandleProps } from '../../hooks/useDragReorder';

// Ручка «≡» листа настройки — место MoveArrows (компонент удалён этим PR,
// правило №11). Область ≥44×44, touch-action:none — жест не путается со
// скроллом страницы и с жестом закрытия BottomSheet (тот сидит на отдельном
// элементе сверху листа). Поведение целиком приходит извне
// (useDragReorder.ts, handleProps) — сама ручка только рисует SVG и держит
// размер тапа.
export function DragHandle(props: DragHandleProps) {
  return (
    <div
      {...props}
      style={{
        ...props.style,
        width: 44,
        minHeight: 44,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'grab',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
        <rect width="18" height="2" rx="1" fill="var(--text-faint)" />
        <rect y="6" width="18" height="2" rx="1" fill="var(--text-faint)" />
        <rect y="12" width="18" height="2" rx="1" fill="var(--text-faint)" />
      </svg>
    </div>
  );
}
