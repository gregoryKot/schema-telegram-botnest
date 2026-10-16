// Блок «РЕЖИМЫ: СВЯЗИ» для текстового экспорта концептуализации (оба
// фронтенда). Режимы идут в порядке карты (MODE_GROUPS), как и на схеме;
// режим без единой заполненной связи в экспорт не попадает. Строки те же, что в
// редакторе режима: у здорового режима — потребности (✓ на схеме), у остальных —
// схемы (⇄), а подпись текста зависит от группы («Что говорит» и так далее).
import type { ConceptModeLink } from '../../apiTypes';
import {
  MODE_GROUPS,
  SCHEMA_DOMAINS,
} from '../../schemaTherapy/schemaTherapyData';
import { NEED_ORDER, getNeedData } from '../../needs/needData';
import { names, oneField } from './exportFields';
import { MANIFEST_FIELD, laneOfMode } from './modeLanes';
import { findModeLink, isModeLinkEmpty, normalizeModeLinks } from './modeLinks';

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
    const lane = laneOfMode(mode.id);
    const healthy = lane === 'healthy';
    blocks.push(
      [
        alias ? `${mode.name} («${alias}»)` : mode.name,
        ...(healthy
          ? oneField('Заботится о потребностях', names(link.needIds, needs))
          : oneField('Схемы', names(link.schemaIds, schemas))),
        ...oneField('Откуда', link.origin),
        ...oneField(lane ? MANIFEST_FIELD[lane].label : 'Текст', link.manifest),
        ...oneField('В терапии', link.strategy),
      ].join('\n'),
    );
  }
  return blocks.length ? ['РЕЖИМЫ: СВЯЗИ', ...blocks].join('\n') : '';
}
