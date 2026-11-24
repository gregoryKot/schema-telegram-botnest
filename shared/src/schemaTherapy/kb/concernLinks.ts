// Запросы → режимы и схемы (ConcernGuide.modeIds / schemaIds): обратная сторона для листов режима и схемы.
import { KB_LINKS } from './links';

function concernsOf(field: 'modeIds' | 'schemaIds', id: string): string[] {
  return KB_LINKS.filter((l) => l.from === 'concern' && l.field === field)
    .flatMap((l) => l.pairs())
    .filter(([, target]) => target === id)
    .map(([concernId]) => concernId);
}

export const concernsOfMode = (modeId: string): string[] =>
  concernsOf('modeIds', modeId);

export const concernsOfSchema = (schemaId: string): string[] =>
  concernsOf('schemaIds', schemaId);
