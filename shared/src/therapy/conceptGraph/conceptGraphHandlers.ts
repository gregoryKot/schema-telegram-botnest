import type { ConceptModeLink } from '../../apiTypes';
import { upsertModeLink } from './modeLinks';

/**
 * Колбэки графа поверх patchConcept фронтенда — одни и те же для сайта и
 * мини-аппа (правило №3): замена связи по modeId и «схема из связи попадает и
 * в концептуализацию». Чистая функция, а не хук: состояния внутри нет.
 */
export function conceptGraphHandlers({
  modeLinks,
  schemaIds,
  patch,
}: {
  modeLinks: ConceptModeLink[];
  schemaIds: string[];
  patch: (p: { modeLinks?: ConceptModeLink[]; schemaIds?: string[] }) => void;
}) {
  return {
    onChangeLink: (link: ConceptModeLink) =>
      patch({ modeLinks: upsertModeLink(modeLinks, link) }),
    onAddSchema: (schemaId: string) => {
      if (!schemaIds.includes(schemaId)) {
        patch({ schemaIds: [...schemaIds, schemaId] });
      }
    },
  };
}
