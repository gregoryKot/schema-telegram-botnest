// Сервер концептуализации для моков api в тестах вкладки: хранит строку,
// применяет тело сохранения как src/therapy/concept-save.ts (полное тело или
// патч: поля поверх, связи — upsert/remove по id) и отдаёт строку целиком с
// новой версией. Тест «сохранил → нашёл» смотрит на `state` — что окажется на
// сервере, — а не на форму последнего тела: сайт шлёт только изменённое.
import { applyLinksPatch, type LinksPatch } from '../../../../shared/src/therapy/conceptGraph/conceptPatch';
import { normalizeModeLinks } from '../../../../shared/src/therapy/conceptGraph/modeLinks';
import { normalizeSchemaLinks } from '../../../../shared/src/therapy/conceptGraph/schemaLinks';
import type { ConceptModeLink, ConceptSchemaLink } from '../../../../shared/src/apiTypes';

type Row = Record<string, unknown>;

export function applyConceptSave(row: Row, body: Row): Row {
  const fields: Row = { ...body };
  const modes = fields.modeLinksPatch as LinksPatch<ConceptModeLink> | undefined;
  const schemas = fields.schemaLinksPatch as LinksPatch<ConceptSchemaLink> | undefined;
  delete fields.modeLinksPatch;
  delete fields.schemaLinksPatch;
  delete fields.baseVersion;
  const next: Row = { ...row, ...fields };
  if (modes) next.modeLinks = applyLinksPatch(normalizeModeLinks(next.modeLinks), modes, (l) => l.modeId);
  if (schemas) next.schemaLinks = applyLinksPatch(normalizeSchemaLinks(next.schemaLinks), schemas, (l) => l.schemaId);
  return next;
}

// Версия строки — как на сервере: патч от устаревшей `baseVersion` получает 409.
export function conceptServer(initial: Row | null) {
  let row: Row | null = initial ? { ...initial } : null;
  let tick = 0;
  const bump = (next: Row) => (row = { ...next, updatedAt: new Date(Date.now() + ++tick).toISOString() });
  return {
    get state(): Row { return row ?? {}; },
    get: async () => row,
    /** Запись из «другого окна» (холст, вторая вкладка): версия сдвигается. */
    writeElsewhere: (patch: Row) => bump({ ...(row ?? {}), ...patch }),
    save: async (_clientId: unknown, body: Row) => {
      const current = (row?.updatedAt as string | undefined) ?? null;
      if (body.baseVersion !== undefined && body.baseVersion !== current) {
        throw Object.assign(new Error('Концептуализацию изменили в другом окне'), { status: 409 });
      }
      return bump(applyConceptSave(row ?? {}, body));
    },
  };
}
