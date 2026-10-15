// Блок «РЕЖИМЫ: СВЯЗИ» для текстового экспорта концептуализации (оба
// фронтенда). Режимы идут в порядке карты (MODE_GROUPS), как и на схеме;
// режим без единой заполненной связи в экспорт не попадает.
import type { ConceptModeLink } from '../../apiTypes';
import {
  MODE_GROUPS,
  SCHEMA_DOMAINS,
} from '../../schemaTherapy/schemaTherapyData';
import { NEED_ORDER, getNeedData } from '../../needs/needData';
import { findModeLink, isModeLinkEmpty, normalizeModeLinks } from './modeLinks';

const INDENT = '  ';

/** Многострочный текст: продолжение строки сдвигается под метку. */
function oneField(label: string, value: string): string[] {
  const v = value.trim();
  if (!v) return [];
  return [`${INDENT}${label}: ${v.split('\n').join(`\n${INDENT}${INDENT}`)}`];
}

function names(ids: string[], all: { id: string; name: string }[]): string {
  const set = new Set(ids);
  return all
    .filter((x) => set.has(x.id))
    .map((x) => x.name)
    .join(' · ');
}

export function formatModeLinksExport(
  modeIds: string[],
  modeLinks: ConceptModeLink[],
): string {
  const onMap = new Set(modeIds);
  const links = normalizeModeLinks(modeLinks);
  const schemas = SCHEMA_DOMAINS.flatMap((d) => d.schemas);
  const needData = getNeedData('ty');
  const needs = NEED_ORDER.map((id) => ({ id, name: needData[id].name }));
  const blocks: string[] = [];
  for (const mode of MODE_GROUPS.flatMap((g) => g.items)) {
    if (!onMap.has(mode.id)) continue;
    const link = findModeLink(links, mode.id);
    if (isModeLinkEmpty(link)) continue;
    const alias = link.alias.trim();
    blocks.push(
      [
        alias ? `${mode.name} («${alias}»)` : mode.name,
        ...oneField('Схемы', names(link.schemaIds, schemas)),
        ...oneField('Потребности', names(link.needIds, needs)),
        ...oneField('Откуда', link.origin),
        ...oneField('Как проявляется', link.manifest),
        ...oneField('В терапии', link.strategy),
      ].join('\n'),
    );
  }
  return blocks.length ? ['РЕЖИМЫ: СВЯЗИ', ...blocks].join('\n') : '';
}
