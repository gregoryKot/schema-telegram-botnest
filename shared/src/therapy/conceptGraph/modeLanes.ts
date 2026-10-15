// Раскладка режимов по клеткам схемы случая (шаблон Редигера, ISST: «Basics
// of a dimensional and dynamic Mode Model», рис. 3) и подсказки «что обычно
// делают с этим режимом в терапии». Чистые данные: ни React, ни форм
// обращения — тексты нейтральны к ты/вы.
import { MODE_GROUPS } from '../../schemaTherapy/schemaTherapyData';

export type ConceptLane = 'healthy' | 'child' | 'critic' | 'coping';
export type CopingKind = 'surrender' | 'avoidance' | 'overcompensation';

const LANE_BY_GROUP: Record<string, ConceptLane> = {
  child: 'child',
  critic: 'critic',
  healthy: 'healthy',
  coping_surrender: 'coping',
  coping_avoidance: 'coping',
  coping_overcompensation: 'coping',
};

const COPING_BY_GROUP: Record<string, CopingKind> = {
  coping_surrender: 'surrender',
  coping_avoidance: 'avoidance',
  coping_overcompensation: 'overcompensation',
};

const GROUP_BY_MODE = new Map<string, string>(
  MODE_GROUPS.flatMap((g) => g.items.map((m) => [m.id, g.id] as const)),
);

/** Клетка схемы, в которую попадает режим; неизвестный id — null. */
export function laneOfMode(modeId: string): ConceptLane | null {
  const group = GROUP_BY_MODE.get(modeId);
  return group ? (LANE_BY_GROUP[group] ?? null) : null;
}

/** Вид копинга для режима из группы копингов; для остальных — undefined. */
export function copingKindOf(modeId: string): CopingKind | undefined {
  const group = GROUP_BY_MODE.get(modeId);
  return group ? COPING_BY_GROUP[group] : undefined;
}

export type StrategyGroup =
  | 'vulnerable'
  | 'angry'
  | 'impulsive'
  | 'punitive'
  | 'demanding'
  | CopingKind
  | 'healthy_adult'
  | 'happy_child'
  | 'good_parent';

// Копинги определяются группой (copingKindOf), остальные режимы — по id.
const STRATEGY_BY_MODE: Record<string, StrategyGroup> = {
  vulnerable_child: 'vulnerable',
  lonely_child: 'vulnerable',
  abandoned_child: 'vulnerable',
  humiliated_child: 'vulnerable',
  dependent_child: 'vulnerable',
  angry_child: 'angry',
  stubborn_child: 'angry',
  enraged_child: 'angry',
  impulsive_child: 'impulsive',
  undisciplined_child: 'impulsive',
  punitive_critic: 'punitive',
  guilt_critic: 'punitive',
  demanding_critic: 'demanding',
  healthy_adult: 'healthy_adult',
  happy_child: 'happy_child',
  good_parent: 'good_parent',
};

/** Группа подхода к режиму: по ней выбирается подсказка из STRATEGY_HINTS. */
export function strategyGroupOf(modeId: string): StrategyGroup | null {
  return STRATEGY_BY_MODE[modeId] ?? copingKindOf(modeId) ?? null;
}

export const STRATEGY_HINTS: Record<StrategyGroup, string> = {
  vulnerable:
    'Прямой контакт с чувствами: рескриптинг в воображении, ограниченное повторное родительство. Потребность сначала получает ответ в терапии.',
  angry:
    'Дать злости прозвучать и найти за ней потребность. Разрушительное выражение ограничивать, к потребности искать реалистичный путь.',
  impulsive:
    'Эмпатическая конфронтация и границы: растить терпимость к фрустрации, учить откладывать желаемое.',
  punitive:
    'Активная конфронтация: сначала терапевт, потом Здоровый Взрослый клиента спорит с голосом и защищает Ребёнка. Голос усвоен в прошлом, клиенту он не принадлежит.',
  demanding:
    'Снизить требования до реалистичных: разобрать, откуда они и чего стоят. С Карающим Критиком борются, с Требовательным чаще договариваются.',
  surrender:
    'Признать, чем капитуляция помогала, показать её цену и тренировать отстаивание своих потребностей.',
  avoidance:
    'Обходить, а не ломать: признать заслугу защиты, показать цену и договориться пустить к чувствам Уязвимого Ребёнка.',
  overcompensation:
    'Эмпатическая конфронтация: понять, от какой боли защищает режим, и ограничить поведение, которое вредит человеку и другим.',
  healthy_adult:
    'Укреплять: он защищает детские режимы, заботится об Уязвимом, ставит границы и постепенно заменяет копинги.',
  happy_child:
    'Поддерживать: игра, радость, свобода выражать чувства и потребности.',
  good_parent:
    'Укреплять тёплый внутренний голос — он приходит на смену Критику.',
};

export interface LaneMeta {
  title: string;
  subtitle: string;
  empty: string;
}

export const LANE_META: Record<ConceptLane, LaneMeta> = {
  healthy: {
    title: 'Здоровые режимы',
    subtitle: 'Опора терапии: то, что растёт',
    empty:
      'Пусто. Здорового Взрослого стоит назвать с первой версии карты — так в ней видна опора рядом с проблемами.',
  },
  child: {
    title: 'Детские режимы',
    subtitle: 'Первичные чувства: страх, боль, злость',
    empty:
      'Пусто. Без детского режима непонятно, от какого чувства защищают копинги.',
  },
  critic: {
    title: 'Критикующие режимы',
    subtitle: 'Голос в голове, усвоенный из прошлого',
    empty: 'Пусто: критикующий голос не отмечен.',
  },
  coping: {
    title: 'Копинги',
    subtitle: 'Что видно снаружи: способ не чувствовать',
    empty: 'Пусто. Копинг обычно виден первым — с ним человек и приходит.',
  },
};

export const COPING_KIND_LABEL: Record<CopingKind, string> = {
  surrender: 'Капитуляция',
  avoidance: 'Избегание',
  overcompensation: 'Гиперкомпенсация',
};

/** Группы MODE_GROUPS, из которых состоит клетка (для фильтра пикера). */
export function groupIdsOfLane(lane: ConceptLane): string[] {
  return MODE_GROUPS.filter((g) => LANE_BY_GROUP[g.id] === lane).map(
    (g) => g.id,
  );
}
