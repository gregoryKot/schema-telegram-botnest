// Связи схемы случая одним куском текста для экспорта: сначала схемы (убеждение
// и опыт), затем режимы. Оба фронтенда зовут только эту функцию (правило №3).
import type { ConceptModeLink, ConceptSchemaLink } from '../../apiTypes';
import { formatModeLinksExport } from './modeLinksExport';
import { formatSchemaLinksExport } from './schemaLinksExport';

/** `c` — склеенная с черновиком концептуализация (ответ сервера + правки). */
export function formatConceptLinksExport(
  schemaIds: string[],
  modeIds: string[],
  c: { modeLinks?: ConceptModeLink[]; schemaLinks?: ConceptSchemaLink[] },
): string {
  const modeLinks = c.modeLinks ?? [];
  return [
    formatSchemaLinksExport(schemaIds, modeIds, modeLinks, c.schemaLinks ?? []),
    formatModeLinksExport(modeIds, modeLinks),
  ]
    .filter(Boolean)
    .join('\n\n');
}
