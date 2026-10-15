import { useEffect, useRef } from 'react';
import { useTr } from '../../utils/addressForm';
import { ConceptModePicker } from './ConceptModePicker';
import { ConceptSchemaPicker } from './ConceptSchemaPicker';
import { boxStyle, hintStyle } from './graphStyles';
import { groupIdsOfLane } from './modeLanes';
import type { AddSection } from './diagram/diagramTypes';

const MODE_GROUP_IDS = (['critic', 'child', 'coping'] as const).flatMap(
  groupIdsOfLane,
);
const HEALTHY_GROUP_IDS = groupIdsOfLane('healthy');

const TITLE: Record<AddSection, string> = {
  modes: 'Режимы на схеме',
  schemas: 'Схемы на схеме',
  healthy: 'Здоровые режимы на схеме',
};

/**
 * Выбор для «+ режим» / «+ схема» в заголовке секции: тап ставит фигуру на
 * схему и снимает. Всплывает под заголовком секции (ConceptDiagram), в
 * картинку схемы не идёт. Режимы и схемы выбираются теми же общими пилюлями,
 * что в полях концептуализации.
 */
export function ConceptAddPanel({
  section,
  modeIds,
  schemaIds,
  onToggleMode,
  onToggleSchema,
  onClose,
}: {
  section: AddSection;
  modeIds: string[];
  /** Схемы, которые сейчас на схеме случая. */
  schemaIds: string[];
  onToggleMode: (modeId: string) => void;
  onToggleSchema: (schemaId: string) => void;
  onClose: () => void;
}) {
  const tr = useTr();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, [section]);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={TITLE[section]}
      style={{
        ...boxStyle,
        maxHeight: 'min(60vh, 480px)',
        overflowY: 'auto',
        boxShadow: '0 8px 28px rgba(0, 0, 0, 0.22)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-8)',
          marginBottom: 'var(--space-8)',
        }}
      >
        <div style={hintStyle}>
          {tr(
            'Нажми, чтобы поставить на схему или убрать.',
            'Нажмите, чтобы поставить на схему или убрать.',
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            flexShrink: 0,
            minHeight: 44,
            padding: '0 14px',
            borderRadius: 'var(--r-12)',
            border: 'none',
            background: 'rgba(var(--fg-rgb),0.07)',
            color: 'var(--text)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Готово
        </button>
      </div>
      {section === 'schemas' ? (
        <ConceptSchemaPicker activeIds={schemaIds} onToggle={onToggleSchema} />
      ) : (
        <ConceptModePicker
          activeModeIds={modeIds}
          onToggle={onToggleMode}
          groupIds={section === 'healthy' ? HEALTHY_GROUP_IDS : MODE_GROUP_IDS}
        />
      )}
    </div>
  );
}
