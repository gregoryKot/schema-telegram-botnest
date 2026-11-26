// Блок «СХЕМЫ: УБЕЖДЕНИЯ И ОПЫТ» для текстового экспорта концептуализации
// (оба фронтенда). Схемы идут в порядке доменов, как на схеме случая; схема
// без единого заполненного поля в экспорт не попадает.
import type { ConceptModeLink, ConceptSchemaLink } from '../../apiTypes';
import { SCHEMA_DOMAINS } from '../../schemaTherapy/schemaTherapyData';
import { NEED_ORDER, getNeedData } from '../../needs/needData';
import { names, oneField } from './exportFields';
import { normalizeModeLinks } from './modeLinks';
import {
  conceptSchemaIds,
  findSchemaLink,
  isSchemaLinkEmpty,
  normalizeSchemaLinks,
} from './schemaLinks';

export function formatSchemaLinksExport(
  schemaIds: string[],
  modeIds: string[],
  modeLinks: ConceptModeLink[],
  schemaLinks: ConceptSchemaLink[],
): string {
  const shown = conceptSchemaIds(
    schemaIds,
    modeIds,
    normalizeModeLinks(modeLinks),
  );
  const links = normalizeSchemaLinks(schemaLinks);
  const needData = getNeedData('ty');
  const needs = NEED_ORDER.map((id) => ({ id, name: needData[id].name }));
  const blocks: string[] = [];
  for (const schema of SCHEMA_DOMAINS.flatMap((d) => d.schemas)) {
    if (!shown.has(schema.id)) continue;
    const link = findSchemaLink(links, schema.id);
    if (isSchemaLinkEmpty(link)) continue;
    blocks.push(
      [
        schema.name,
        ...oneField('Убеждение', link.belief),
        ...oneField('Как нарушалась потребность', link.origin),
        ...oneField('Блокирует потребности', names(link.needIds, needs)),
      ].join('\n'),
    );
  }
  return blocks.length ? ['СХЕМЫ: УБЕЖДЕНИЯ И ОПЫТ', ...blocks].join('\n') : '';
}
