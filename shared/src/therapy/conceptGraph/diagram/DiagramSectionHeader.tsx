import { HEAD_H } from './diagramSections';
import type { DiagramSection } from './diagramTypes';

/**
 * Заголовок секции: название, подсказка «о чём это» и своя кнопка добавления
 * (data-export-skip — в картинку схемы не идёт). Заголовок — часть картины:
 * по нему видно, чем секция отличается от соседней.
 */
export function DiagramSectionHeader({
  section,
  open,
  onAdd,
}: {
  section: DiagramSection;
  open: boolean;
  onAdd: () => void;
}) {
  return (
    <div
      role="group"
      aria-label={section.title}
      data-section={section.id}
      style={{
        position: 'absolute',
        left: section.x,
        top: section.y,
        width: section.w,
        height: HEAD_H,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-8)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
          {section.title}
        </div>
        <div
          style={{ fontSize: 11, lineHeight: 1.3, color: 'var(--text-sub)' }}
        >
          {section.hint}
        </div>
      </div>
      {section.add && (
        <button
          type="button"
          data-export-skip
          aria-expanded={open}
          onClick={onAdd}
          style={{
            flexShrink: 0,
            minHeight: 44,
            padding: '0 12px',
            borderRadius: 'var(--r-12)',
            border: 'none',
            background: 'transparent',
            color: 'var(--accent)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {open ? 'Свернуть' : section.add}
        </button>
      )}
    </div>
  );
}
