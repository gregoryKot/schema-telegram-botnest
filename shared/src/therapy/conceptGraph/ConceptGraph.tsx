import { useState } from 'react';
import type { ConceptModeLink, ConceptSchemaLink } from '../../apiTypes';
import { buildConceptGraph } from './conceptGraphModel';
import type { ConceptGraphSource } from './conceptGraphTypes';
import { findModeLink } from './modeLinks';
import { findSchemaLink } from './schemaLinks';
import { useConceptGraphTracking } from './useConceptGraphTracking';
import { ConceptDiagram } from './diagram/ConceptDiagram';
import { ConceptAddPanel } from './ConceptAddPanel';
import type { AddSection } from './diagram/diagramTypes';
import { ConceptGraphIntro } from './ConceptGraphIntro';
import { ConceptModeEditor } from './ConceptModeEditor';
import { ConceptSchemaEditor } from './ConceptSchemaEditor';
import { hintStyle } from './graphStyles';
import { useTr } from '../../utils/addressForm';

type Open = { kind: 'mode' | 'schema'; id: string } | null;

/**
 * Схема случая: диаграмма с кругом базовых потребностей в центре (схемы с
 * убеждением и опытом слева, режимы ещё левее, Здоровый Взрослый справа), под
 * ней редактор открытой фигуры, порядок смены режимов и мягкие подсказки
 * «чего не хватает». Пустая секция — часть картины, а не пробел.
 */
export function ConceptGraph({
  source,
  onToggleMode,
  onChangeLink,
  onChangeSchemaLink,
  onToggleSchema,
  onAddSchema,
  track,
}: {
  source: ConceptGraphSource;
  onToggleMode: (modeId: string) => void;
  onChangeLink: (link: ConceptModeLink) => void;
  onChangeSchemaLink: (link: ConceptSchemaLink) => void;
  onToggleSchema: (schemaId: string) => void;
  onAddSchema: (schemaId: string) => void;
  track: (name: string, meta?: Record<string, unknown>) => void;
}) {
  const tr = useTr();
  const [open, setOpen] = useState<Open>(null);
  const [add, setAdd] = useState<AddSection | null>(null);
  const { markLinked, markSchemaLinked } = useConceptGraphTracking(track);
  const graph = buildConceptGraph(source, tr);

  const modeCard =
    open?.kind === 'mode'
      ? Object.values(graph.lanes)
          .flat()
          .find((c) => c.modeId === open.id)
      : undefined;
  const schemaCard =
    open?.kind === 'schema'
      ? graph.schemas.find((s) => s.id === open.id)
      : undefined;
  const toggleOpen = (kind: 'mode' | 'schema', id: string) =>
    setOpen((cur) =>
      cur?.kind === kind && cur.id === id ? null : { kind, id },
    );
  // Режим, снятый с карты, не должен «воскреснуть» открытым редактором при
  // повторном добавлении.
  const toggleMode = (modeId: string) => {
    if (open?.kind === 'mode' && open.id === modeId) setOpen(null);
    onToggleMode(modeId);
  };
  const toggleSchema = (schemaId: string) => {
    if (open?.kind === 'schema' && open.id === schemaId) setOpen(null);
    onToggleSchema(schemaId);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-12)',
      }}
    >
      <ConceptGraphIntro graph={graph} />
      <ConceptDiagram
        graph={graph}
        openId={
          open && (modeCard || schemaCard) ? `${open.kind}:${open.id}` : null
        }
        addOpen={add}
        panel={
          add && (
            <ConceptAddPanel
              section={add}
              modeIds={source.modeIds}
              schemaIds={graph.schemas.map((s) => s.id)}
              onToggleMode={toggleMode}
              onToggleSchema={toggleSchema}
              onClose={() => setAdd(null)}
            />
          )
        }
        onOpenMode={(id) => toggleOpen('mode', id)}
        onOpenSchema={(id) => toggleOpen('schema', id)}
        onAdd={(section) => setAdd((cur) => (cur === section ? null : section))}
      />
      {modeCard && (
        <ConceptModeEditor
          key={modeCard.modeId}
          card={modeCard}
          link={findModeLink(source.modeLinks, modeCard.modeId)}
          conceptSchemaIds={source.schemaIds}
          onChangeLink={(link) => {
            markLinked(link.modeId);
            onChangeLink(link);
          }}
          onAddSchema={onAddSchema}
          onToggleMode={toggleMode}
          onClose={() => setOpen(null)}
        />
      )}
      {schemaCard && (
        <ConceptSchemaEditor
          key={schemaCard.id}
          card={schemaCard}
          link={findSchemaLink(source.schemaLinks, schemaCard.id)}
          onChangeLink={(link) => {
            markSchemaLinked(link.schemaId);
            onChangeSchemaLink(link);
          }}
          onRemove={toggleSchema}
          onClose={() => setOpen(null)}
        />
      )}
      {graph.sequence && (
        <p style={{ ...hintStyle, margin: 0 }}>
          <b>Как режимы сменяют друг друга:</b> <span>{graph.sequence}</span>
        </p>
      )}
    </div>
  );
}
