import { api } from '../../../api';
import { ConceptGraph } from '../../../../../shared/src/therapy/conceptGraph/ConceptGraph';
import { conceptGraphHandlers } from '../../../../../shared/src/therapy/conceptGraph/conceptGraphHandlers';
import { conceptGraphSource } from '../../../../../shared/src/therapy/conceptGraph/conceptGraphSource';
import type { ClientDetail } from '../types';

/**
 * Вид «Схема» листа концептуализации: схема случая по модели режимов. Правки
 * идут через те же patchConcept/toggleModeId, что и вид «Поля», — кнопка
 * «Сохранить концептуализацию» и ошибка общие под обоими видами. Картинкой
 * схему не скачать: файл из WebView Telegram скачивается ненадёжно.
 */
export function ConceptGraphView({ detail }: { detail: ClientDetail }) {
  const { concept, localConcept, activeSchemaIds, toggleModeId, patchConcept } =
    detail;
  const source = conceptGraphSource({ ...concept, ...localConcept });
  const { onChangeLink, onAddSchema } = conceptGraphHandlers({
    modeLinks: source.modeLinks,
    schemaIds: activeSchemaIds,
    patch: patchConcept,
  });
  return (
    <ConceptGraph
      source={source}
      onToggleMode={toggleModeId}
      onChangeLink={onChangeLink}
      onAddSchema={onAddSchema}
      track={api.trackEvent}
    />
  );
}
