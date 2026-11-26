import { useEffect, useRef } from 'react';
import { useTr } from '../../utils/addressForm';
import { ConceptModePicker } from './ConceptModePicker';
import { ConceptSchemaPicker } from './ConceptSchemaPicker';
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
 * картинку схемы не идёт. Режимы и схемы выбираются теми же общими чипами по
 * группам, что в полях концептуализации; вид — .cg-panel (concept-graph.css).
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
      className="cg-panel"
    >
      <div className="cg-panel-head">
        <div className="cg-panel-hint">
          {tr(
            'Нажми, чтобы поставить на схему или убрать.',
            'Нажмите, чтобы поставить на схему или убрать.',
          )}
        </div>
        <button
          type="button"
          className="ds-btn ds-btn--secondary ds-btn--sm"
          onClick={onClose}
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
