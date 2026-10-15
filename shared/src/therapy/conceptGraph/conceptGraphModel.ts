// Модель графической концептуализации: из плоских полей концептуализации,
// связей режимов и текстов схем собирает карточки для схемы случая и
// подсказки «чего не хватает». Чистая функция, без React.
import {
  MODE_GROUPS,
  SCHEMA_DOMAINS,
} from '../../schemaTherapy/schemaTherapyData';
import { NEED_ORDER, getNeedData, type Tr } from '../../needs/needData';
import {
  STRATEGY_HINTS,
  copingKindOf,
  laneOfMode,
  strategyGroupOf,
  type ConceptLane,
} from './modeLanes';
import { findModeLink, isModeLinkEmpty } from './modeLinks';
import {
  conceptSchemaIds,
  findSchemaLink,
  isSchemaLinkEmpty,
} from './schemaLinks';
import type {
  ConceptGraphModel,
  ConceptGraphSource,
  GraphModeCard,
  GraphNeedChip,
  GraphSchemaCard,
  GraphSchemaChip,
} from './conceptGraphTypes';

const text = (v: string | null | undefined): string => (v ?? '').trim();

/** Имена потребностей нейтральны к форме обращения — она нужна только билдеру подсказок. */
function needChips(ids: ReadonlySet<string>): GraphNeedChip[] {
  const data = getNeedData('ty');
  return NEED_ORDER.filter((id) => ids.has(id)).map((id) => ({
    id,
    name: data[id].name,
  }));
}

/** Схемы в порядке доменов; неизвестные id пропускаются. */
function schemaChips(ids: ReadonlySet<string>): GraphSchemaChip[] {
  return SCHEMA_DOMAINS.flatMap((d) =>
    d.schemas
      .filter((s) => ids.has(s.id))
      .map((s) => ({ id: s.id, name: s.name, color: d.color })),
  );
}

function buildCards(src: ConceptGraphSource): GraphModeCard[] {
  const onMap = new Set(src.modeIds);
  return MODE_GROUPS.flatMap((group) =>
    group.items
      .filter((mode) => onMap.has(mode.id) && laneOfMode(mode.id))
      .map((mode) => {
        const link = findModeLink(src.modeLinks, mode.id);
        const strategyGroup = strategyGroupOf(mode.id);
        return {
          modeId: mode.id,
          name: mode.name,
          alias: link.alias.trim(),
          color: group.color,
          lane: laneOfMode(mode.id) as ConceptLane,
          copingKind: copingKindOf(mode.id),
          schemas: schemaChips(new Set(link.schemaIds)),
          needs: needChips(new Set(link.needIds)),
          manifest: link.manifest.trim(),
          strategyHint: strategyGroup ? STRATEGY_HINTS[strategyGroup] : '',
          empty: isModeLinkEmpty(link),
        };
      }),
  );
}

/** Схемы схемы случая: порядок доменов, тексты — из ConceptSchemaLink. */
function buildSchemas(src: ConceptGraphSource): GraphSchemaCard[] {
  const shown = conceptSchemaIds(src.schemaIds, src.modeIds, src.modeLinks);
  return SCHEMA_DOMAINS.flatMap((d) =>
    d.schemas
      .filter((s) => shown.has(s.id))
      .map((s) => {
        const link = findSchemaLink(src.schemaLinks, s.id);
        const blocked = new Set(link.needIds);
        return {
          id: s.id,
          name: s.name,
          color: d.color,
          domain: d.domain,
          belief: link.belief.trim(),
          origin: link.origin.trim(),
          needIds: NEED_ORDER.filter((id) => blocked.has(id)),
          empty: isSchemaLinkEmpty(link),
        };
      }),
  );
}

function buildGaps(
  lanes: Record<ConceptLane, GraphModeCard[]>,
  modeCount: number,
  tr: Tr,
): ConceptGraphModel['gaps'] {
  if (modeCount === 0) return [];
  const gaps: ConceptGraphModel['gaps'] = [];
  if (lanes.coping.length > 0 && lanes.child.length === 0) {
    gaps.push({
      id: 'coping_without_child',
      text: 'Копинги есть, а детского режима нет. От какого чувства они защищают?',
    });
  }
  const hasAngry = lanes.child.some(
    (c) => strategyGroupOf(c.modeId) === 'angry',
  );
  if (lanes.child.length > 0 && !hasAngry) {
    gaps.push({
      id: 'no_angry',
      text: 'Клетка злого Ребёнка пуста. Так бывает, когда злость под запретом; тогда одна из целей — вернуть её в поведение Здорового Взрослого.',
    });
  }
  if (Object.values(lanes).some((cards) => cards.some((c) => c.empty))) {
    gaps.push({
      id: 'unlinked',
      text: tr(
        'Часть режимов пока без связей — нажми на фигуру режима, чтобы связать его со схемами и записать текст.',
        'Часть режимов пока без связей — нажмите на фигуру режима, чтобы связать его со схемами и записать текст.',
      ),
    });
  }
  return gaps;
}

export function buildConceptGraph(
  src: ConceptGraphSource,
  tr: Tr,
): ConceptGraphModel {
  const lanes: Record<ConceptLane, GraphModeCard[]> = {
    healthy: [],
    child: [],
    critic: [],
    coping: [],
  };
  const cards = buildCards(src);
  for (const card of cards) lanes[card.lane].push(card);
  return {
    lanes,
    schemas: buildSchemas(src),
    sequence: text(src.modeTransitions),
    gaps: buildGaps(lanes, cards.length, tr),
    modeCount: cards.length,
  };
}
