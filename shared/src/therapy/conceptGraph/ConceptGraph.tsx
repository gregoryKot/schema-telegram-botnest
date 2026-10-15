import { useEffect, useRef, useState } from 'react';
import { useTr } from '../../utils/addressForm';
import type { ConceptModeLink } from '../../apiTypes';
import { buildConceptGraph } from './conceptGraphModel';
import type { ConceptGraphSource } from './conceptGraphTypes';
import { groupIdsOfLane, type ConceptLane } from './modeLanes';
import { findModeLink } from './modeLinks';
import { useConceptGraphTracking } from './useConceptGraphTracking';
import { ConceptDiagram } from './diagram/ConceptDiagram';
import { ConceptGaps } from './ConceptGaps';
import { ConceptGraphIntro } from './ConceptGraphIntro';
import { ConceptModeEditor } from './ConceptModeEditor';
import { ConceptModePicker } from './ConceptModePicker';
import { boxStyle, hintStyle } from './graphStyles';

const toolbarButton = {
  minHeight: 44,
  padding: '0 12px',
  borderRadius: 'var(--r-12)',
  border: 'none',
  background: 'transparent',
  color: 'var(--accent)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
} as const;

/**
 * Схема случая по модели режимов (шаблон Редигера, ISST): диаграмма из фигур
 * и линий, под ней редактор открытого режима, порядок смены режимов и мягкие
 * подсказки «чего не хватает». Пустая клетка — часть картины, а не пробел.
 */
export function ConceptGraph({
  source,
  onToggleMode,
  onChangeLink,
  onAddSchema,
  track,
}: {
  source: ConceptGraphSource;
  onToggleMode: (modeId: string) => void;
  onChangeLink: (link: ConceptModeLink) => void;
  onAddSchema: (schemaId: string) => void;
  track: (name: string, meta?: Record<string, unknown>) => void;
}) {
  const tr = useTr();
  const [openModeId, setOpenModeId] = useState<string | null>(null);
  // null — выбор режимов закрыт; undefined в groupIds — показать все группы.
  const [picker, setPicker] = useState<{ groupIds?: string[] } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const { markLinked } = useConceptGraphTracking(track);
  const graph = buildConceptGraph(source, tr);

  const openCard = Object.values(graph.lanes)
    .flat()
    .find((c) => c.modeId === openModeId);
  // Режим, снятый с карты, не должен «воскреснуть» открытым редактором при
  // повторном добавлении.
  const toggleMode = (modeId: string) => {
    if (openModeId === modeId) setOpenModeId(null);
    onToggleMode(modeId);
  };
  const pickLane = (lane: ConceptLane) =>
    setPicker({ groupIds: groupIdsOfLane(lane) });
  useEffect(() => {
    if (picker) pickerRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [picker]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-12)',
      }}
    >
      <ConceptGraphIntro />
      {/* Управление не попадает в картинку схемы (data-export-skip). */}
      <div data-export-skip>
        <button
          type="button"
          aria-expanded={picker !== null}
          onClick={() => setPicker(picker ? null : {})}
          style={toolbarButton}
        >
          {picker ? 'Свернуть' : '+ режим'}
        </button>
        {picker && (
          <div ref={pickerRef} style={boxStyle}>
            <ConceptModePicker
              activeModeIds={source.modeIds}
              onToggle={toggleMode}
              groupIds={picker.groupIds}
            />
          </div>
        )}
      </div>
      <ConceptDiagram
        graph={graph}
        openModeId={openCard ? openCard.modeId : null}
        onToggleMode={(id) => setOpenModeId((cur) => (cur === id ? null : id))}
        onPickLane={pickLane}
      />
      {openCard && (
        <ConceptModeEditor
          key={openCard.modeId}
          card={openCard}
          link={findModeLink(source.modeLinks, openCard.modeId)}
          conceptSchemaIds={source.schemaIds}
          onChangeLink={(link) => {
            markLinked(link.modeId);
            onChangeLink(link);
          }}
          onAddSchema={onAddSchema}
          onToggleMode={toggleMode}
          onClose={() => setOpenModeId(null)}
        />
      )}
      {graph.sequence && (
        <p style={{ ...hintStyle, margin: 0 }}>
          <b>Как режимы сменяют друг друга:</b> <span>{graph.sequence}</span>
        </p>
      )}
      <ConceptGaps gaps={graph.gaps} />
    </div>
  );
}
