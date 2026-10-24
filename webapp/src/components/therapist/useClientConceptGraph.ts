import { useCallback, useRef, type RefObject } from 'react';
import { api } from '../../api';
import { conceptGraphHandlers } from '../../../../shared/src/therapy/conceptGraph/conceptGraphHandlers';
import { conceptGraphSource } from '../../../../shared/src/therapy/conceptGraph/conceptGraphSource';
import { CONCEPT_GRAPH_OPEN_EVENT } from '../../../../shared/src/share/analytics';
import type { ClientDetail } from './clientSheetTypes';
import { useConceptGraphImage } from './useConceptGraphImage';
import { useOpenConceptCanvas } from './useOpenConceptCanvas';

const noop = () => {};

/**
 * Всё, что нужно виду «Схема» вкладки концептуализации, в одном месте: источник
 * схемы с несохранёнными правками, обработчики правок (те же patchConcept /
 * toggleModeId, что у вида «Поля»), «Скачать картинкой» и «Открыть на холсте».
 * Граф рисуется то в потоке кабинета, то в листе «На весь экран» — оба раза из
 * этих же данных и обработчиков, второй копии логики нет. `graphRef` (создаёт
 * вызывающий) указывает на контейнер графа, который сейчас на экране: картинка
 * снимает его.
 *
 * `concept_graph_open` ConceptGraph шлёт при каждом монтировании, а при
 * разворачивании на весь экран граф монтируется заново; открытие схемы одно,
 * поэтому повторное в рамках этого вида отбрасывается.
 */
export function useClientConceptGraph(
  detail: ClientDetail,
  graphRef: RefObject<HTMLDivElement | null>,
  onOpenCanvas?: (mapId: number) => void,
) {
  const { concept, localConcept, activeSchemaIds, toggleModeId, patchConcept } = detail;
  const opened = useRef(false);
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
  const track = useCallback((name: string, ...rest: [meta?: Record<string, unknown>]) => {
    if (name === CONCEPT_GRAPH_OPEN_EVENT) {
      if (opened.current) return;
      opened.current = true;
    }
    api.trackEvent(name, ...rest);
  }, []);

  return {
    image,
    canvas: onOpenCanvas ? canvas : undefined,
    graphProps: {
      source,
      onToggleMode: toggleModeId,
      onChangeLink: handlers.onChangeLink,
      onChangeSchemaLink: handlers.onChangeSchemaLink,
      onToggleSchema: handlers.onToggleSchema,
      onAddSchema: handlers.onAddSchema,
      track,
    },
  };
}
