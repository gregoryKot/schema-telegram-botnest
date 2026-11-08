import { HEAD_H } from './diagramSections';
import type { DiagramSection } from './diagramTypes';
import { useConceptSkin } from '../conceptSkin';
import { LINK_BTN } from '../conceptInlineStyles';

// Зона кнопки — всегда; вид — классом skin.link (сайт: ds-link), без skin — LINK_BTN.
const BOX = { flexShrink: 0, minHeight: 44, padding: '0 12px' } as const;

/**
 * Заголовок секции: название, подсказка «о чём это» и своя кнопка добавления
 * (data-export-skip — в картинку схемы не идёт). Заголовок — часть картины:
 * по нему видно, чем секция отличается от соседней. Без `onAdd` (схема только
 * для чтения) кнопки нет.
 */
export function DiagramSectionHeader({
  section,
  open,
  onAdd,
}: {
  section: DiagramSection;
  open: boolean;
  onAdd?: () => void;
}) {
  const skin = useConceptSkin();
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
      {section.add && onAdd && (
        <button
          type="button"
          data-export-skip
          aria-expanded={open}
          onClick={onAdd}
          className={skin?.link}
          style={skin ? BOX : { ...LINK_BTN, ...BOX }}
        >
          {open ? 'Свернуть' : section.add}
        </button>
      )}
    </div>
  );
}
