import type { ConceptModeLink, ConceptSchemaLink } from '../../apiTypes';
import { upsertModeLink } from './modeLinks';
import { conceptSchemaIds, upsertSchemaLink } from './schemaLinks';

type Patch = {
  modeLinks?: ConceptModeLink[];
  schemaLinks?: ConceptSchemaLink[];
  schemaIds?: string[];
};

/**
 * Колбэки графа поверх patchConcept фронтенда — одни и те же для сайта и
 * мини-аппа (правило №3): замена связи режима по modeId, замена текстов схемы
 * по schemaId, «схема из связи попадает и в концептуализацию» и «+ схема» с
 * переключением. Чистая функция, а не хук: состояния внутри нет.
 *
 * Схема на схеме случая — это отмеченные в концептуализации плюс упомянутые в
 * связях режимов. Поэтому снять схему мало удалить id из schemaIds: пока режим
 * на неё ссылается, она остаётся на экране. Снятие убирает id и оттуда, и из
 * связей режимов одним патчем (два патча подряд затёрли бы друг друга: оба
 * считаются от одного и того же массива). Тексты схемы остаются.
 */
export function conceptGraphHandlers({
  modeIds,
  modeLinks,
  schemaLinks,
  schemaIds,
  patch,
}: {
  modeIds: string[];
  modeLinks: ConceptModeLink[];
  schemaLinks: ConceptSchemaLink[];
  schemaIds: string[];
  patch: (p: Patch) => void;
}) {
  return {
    onChangeLink: (link: ConceptModeLink) =>
      patch({ modeLinks: upsertModeLink(modeLinks, link) }),
    onChangeSchemaLink: (link: ConceptSchemaLink) =>
      patch({ schemaLinks: upsertSchemaLink(schemaLinks, link) }),
    onAddSchema: (schemaId: string) => {
      if (!schemaIds.includes(schemaId)) {
        patch({ schemaIds: [...schemaIds, schemaId] });
      }
    },
    onToggleSchema: (schemaId: string) => {
      if (!conceptSchemaIds(schemaIds, modeIds, modeLinks).has(schemaId)) {
        patch({ schemaIds: [...schemaIds, schemaId] });
        return;
      }
      patch({
        schemaIds: schemaIds.filter((x) => x !== schemaId),
        modeLinks: modeLinks.map((l) =>
          l.schemaIds.includes(schemaId)
            ? { ...l, schemaIds: l.schemaIds.filter((x) => x !== schemaId) }
            : l,
        ),
      });
    },
  };
}
