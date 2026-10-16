import { useRef } from 'react';
import { api } from '../../api';
import { ConceptGraph } from '../../../../shared/src/therapy/conceptGraph/ConceptGraph';
import { conceptGraphHandlers } from '../../../../shared/src/therapy/conceptGraph/conceptGraphHandlers';
import { conceptGraphSource } from '../../../../shared/src/therapy/conceptGraph/conceptGraphSource';
import type { ClientDetail } from './clientSheetTypes';
import { useConceptGraphImage } from './useConceptGraphImage';
import { useOpenConceptCanvas } from './useOpenConceptCanvas';
import { ConceptGraphToolbar } from './ConceptGraphToolbar';

const noop = () => {};

// Вид «Схема» вкладки концептуализации: схема случая (потребности в центре).
// Правки идут через те же patchConcept/toggleModeId, что и вид «Поля», —
// автосохранение и экспорт остаются одни на оба вида. «Скачать картинкой»
// только здесь: мини-апп файл из WebView Telegram не скачивает. «Открыть на холсте» —
// тоже сайт (карты режимов в мини-аппе нет). Схеме нужна вся
// ширина (четыре колонки от 960px), поэтому ClientConceptTab в виде «Схема» не
// ставит боковую колонку рядом: сверка с YSQ и история версий уходят под схему.
export function ClientConceptGraph({ detail, onOpenCanvas }: { detail: ClientDetail; onOpenCanvas?: (mapId: number) => void }) {
  const { concept, localConcept, activeSchemaIds, toggleModeId, patchConcept } =
    detail;
  const graphRef = useRef<HTMLDivElement>(null);
  const image = useConceptGraphImage(graphRef);
  const source = conceptGraphSource({ ...concept, ...localConcept });
  const handlers = conceptGraphHandlers({
    modeIds: source.modeIds,
    modeLinks: source.modeLinks,
    schemaLinks: source.schemaLinks,
    schemaIds: activeSchemaIds,
    patch: patchConcept,
  });
  const canvas = useOpenConceptCanvas({
    clientId: detail.selectedClient?.telegramId,
    source,
    onOpened: onOpenCanvas ?? noop,
  });

  return (
    <div style={{ minWidth: 0 }}>
      <ConceptGraphToolbar image={image} canvas={onOpenCanvas ? canvas : undefined} />
      <div ref={graphRef} style={{ padding: 'var(--space-8)' }}>
        <ConceptGraph
          source={source}
          onToggleMode={toggleModeId}
          onChangeLink={handlers.onChangeLink}
          onChangeSchemaLink={handlers.onChangeSchemaLink}
          onToggleSchema={handlers.onToggleSchema}
          onAddSchema={handlers.onAddSchema}
          track={api.trackEvent}
        />
      </div>
    </div>
  );
}
