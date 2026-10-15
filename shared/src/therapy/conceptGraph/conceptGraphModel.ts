// Модель графической концептуализации: из плоских полей концептуализации и
// связей режимов собирает раскладку по клеткам шаблона Редигера, корни и
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
import type {
  ConceptGraphModel,
  ConceptGraphSource,
  GraphModeCard,
  GraphNeedChip,
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
      .filter((mode) => onMap.has(mode.id))
      .map((mode) => {
        const link = findModeLink(src.modeLinks, mode.id);
        const strategyGroup = strategyGroupOf(mode.id);
        return {
          modeId: mode.id,
          name: mode.name,
          alias: link.alias.trim(),
          color: group.color,
          copingKind: copingKindOf(mode.id),
          schemas: schemaChips(new Set(link.schemaIds)),
          needs: needChips(new Set(link.needIds)),
          origin: link.origin.trim(),
          manifest: link.manifest.trim(),
          strategy: link.strategy.trim(),
          strategyHint: strategyGroup ? STRATEGY_HINTS[strategyGroup] : '',
          empty: isModeLinkEmpty(link),
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
        'Часть режимов пока без связей — нажми на фигуру режима, чтобы добавить схемы, потребности и истоки.',
        'Часть режимов пока без связей — нажмите на фигуру режима, чтобы добавить схемы, потребности и истоки.',
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
  for (const card of cards) {
    const lane = laneOfMode(card.modeId);
    if (lane) lanes[lane].push(card);
  }
  const mapNeeds = new Set(cards.flatMap((c) => c.needs.map((n) => n.id)));
  return {
    lanes,
    trigger: text(src.triggers),
    goals: text(src.goals),
    problems: text(src.currentProblems),
    sequence: text(src.modeTransitions),
    roots: {
      experience: text(src.earlyExperience),
      unmetNeeds: text(src.unmetNeeds),
      needs: needChips(mapNeeds),
      schemas: schemaChips(new Set(src.schemaIds)),
    },
    gaps: buildGaps(lanes, cards.length, tr),
    modeCount: cards.length,
  };
}
