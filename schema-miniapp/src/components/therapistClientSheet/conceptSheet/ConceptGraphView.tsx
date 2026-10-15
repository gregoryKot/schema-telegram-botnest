import { api } from '../../../api';
import { ConceptGraph } from '../../../../../shared/src/therapy/conceptGraph/ConceptGraph';
import { conceptGraphHandlers } from '../../../../../shared/src/therapy/conceptGraph/conceptGraphHandlers';
import { conceptGraphSource } from '../../../../../shared/src/therapy/conceptGraph/conceptGraphSource';
import type { ClientDetail } from '../types';

/**
 * Вид «Схема» листа концептуализации: схема случая (потребности в центре). Правки
 * идут через те же patchConcept/toggleModeId, что и вид «Поля», — кнопка
 * «Сохранить концептуализацию» и ошибка общие под обоими видами. Картинкой
 * схему не скачать: файл из WebView Telegram скачивается ненадёжно.
 */
export function ConceptGraphView({ detail }: { detail: ClientDetail }) {
  const { concept, localConcept, activeSchemaIds, toggleModeId, patchConcept } =
    detail;
  const source = conceptGraphSource({ ...concept, ...localConcept });
  const handlers = conceptGraphHandlers({
    modeIds: source.modeIds,
    modeLinks: source.modeLinks,
    schemaLinks: source.schemaLinks,
    schemaIds: activeSchemaIds,
    patch: patchConcept,
  });
  return (
    <ConceptGraph
      source={source}
      onToggleMode={toggleModeId}
      onChangeLink={handlers.onChangeLink}
      onChangeSchemaLink={handlers.onChangeSchemaLink}
      onToggleSchema={handlers.onToggleSchema}
      onAddSchema={handlers.onAddSchema}
      track={api.trackEvent}
    />
  );
}
