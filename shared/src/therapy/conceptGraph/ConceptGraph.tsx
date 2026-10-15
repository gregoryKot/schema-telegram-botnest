import { useState, type ReactNode } from 'react';
import { useTr } from '../../utils/addressForm';
import type { ConceptModeLink } from '../../apiTypes';
import { buildConceptGraph } from './conceptGraphModel';
import type { ConceptGraphSource } from './conceptGraphTypes';
import { laneOfMode, type ConceptLane } from './modeLanes';
import { findModeLink } from './modeLinks';
import { useConceptGraphTracking } from './useConceptGraphTracking';
import { ConceptLaneCell } from './ConceptLaneCell';
import { ConceptModeEditor } from './ConceptModeEditor';
import { ConceptGraphIntro } from './ConceptGraphIntro';
import {
  ConceptArrow,
  ConceptGaps,
  ConceptTextBlock,
} from './ConceptGraphBlocks';
import { ConceptRoots } from './ConceptRoots';

const ROW = {
  display: 'grid',
  gap: 'var(--space-12)',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
} as const;

/**
 * Схема случая по модели режимов (шаблон Редигера, ISST). Наверху триггер и
 * здоровые режимы, в середине детские и критик, ниже копинги, цена копингов и
 * корни. Пустая клетка — часть картины, а не пробел.
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
  const { markLinked } = useConceptGraphTracking(track);
  const graph = buildConceptGraph(source, tr);

  const openCard = Object.values(graph.lanes)
    .flat()
    .find((c) => c.modeId === openModeId);
  const openLane = openCard ? laneOfMode(openCard.modeId) : null;
  const toggleOpen = (modeId: string) =>
    setOpenModeId((cur) => (cur === modeId ? null : modeId));
  // Режим, снятый с карты, не должен «воскреснуть» открытым редактором при
  // повторном добавлении.
  const toggleMode = (modeId: string) => {
    if (openModeId === modeId) setOpenModeId(null);
    onToggleMode(modeId);
  };

  const cell = (lane: ConceptLane, footer?: ReactNode) => (
    <ConceptLaneCell
      lane={lane}
      cards={graph.lanes[lane]}
      allModeIds={source.modeIds}
      openModeId={openModeId}
      onOpenCard={toggleOpen}
      onToggleMode={toggleMode}
      footer={footer}
    />
  );
  // Редактор встаёт сразу под рядом, в котором лежит карточка: на всю ширину,
  // а не втиснутым в половину ряда.
  const editorUnder = (lanes: ConceptLane[]) =>
    openCard && openLane && lanes.includes(openLane) ? (
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
    ) : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-12)',
      }}
    >
      <ConceptGraphIntro />
      <div style={ROW}>
        <ConceptTextBlock
          title="Триггер"
          hint="Что запускает цикл сейчас"
          value={graph.trigger}
          emptyText="Триггеры пока не описаны"
        />
        {cell(
          'healthy',
          graph.goals && (
            <div style={{ marginTop: 'var(--space-10)' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Цели терапии</div>
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {graph.goals}
              </div>
            </div>
          ),
        )}
      </div>
      {editorUnder(['healthy'])}
      <div style={ROW}>
        {cell('child')}
        {cell('critic')}
      </div>
      {editorUnder(['child', 'critic'])}
      <ConceptArrow label="напряжение снимает копинг" />
      {cell('coping')}
      {editorUnder(['coping'])}
      <ConceptArrow label="цена" />
      <ConceptTextBlock
        title="Проблемы сейчас"
        hint="Цена копингов в жизни"
        value={graph.problems}
        emptyText="Проблемы пока не описаны"
      />
      <ConceptRoots roots={graph.roots} />
      {graph.sequence && (
        <ConceptTextBlock
          title="Как режимы сменяют друг друга"
          value={graph.sequence}
        />
      )}
      <ConceptGaps gaps={graph.gaps} />
    </div>
  );
}
