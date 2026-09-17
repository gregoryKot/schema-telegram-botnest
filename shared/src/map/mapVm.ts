/**
 * Карта себя — накопитель разборов и единственный экран, отвечающий на
 * вопрос «где я в этой системе».
 *
 * Три полосы по Рёдигеру: сверху тот, кто держит, посередине те, кто выходит
 * на сцену, снизу те, кто прячется за ними. Карта не рисуется руками — она
 * складывается из разборов; руками правятся только имена.
 *
 * Полосы показываются ПО МЕРЕ ОТКРЫТИЯ: экран из трёх пустых рамок читается
 * как неудача, а пустая клетка в схема-терапии — информация, а не долг
 * (Рёдигер: пустоты карты и есть цель терапии). Отсюда же отказ от процентов
 * заполненности и любых индикаторов «сколько осталось».
 *
 * Режим, не встречавшийся месяц, не исчезает и не обнуляется — он гаснет и
 * показывается с датой: это возвращает к вопросу «его правда нет или его не
 * видно», вместо упрёка за пропуск.
 */
import { findTestGroupByModeId } from '../mode/modeTest';
import { modeDisplayName } from '../mode/modeDisplayName';

/** Полосы карты сверху вниз. */
export type MapLaneId = 'healthy' | 'stage' | 'backstage' | 'origins';

/** Дней без единой записи, после которых режим считается затихшим. */
export const DORMANT_AFTER_DAYS = 30;

/** Разборов, после которых открывается полоса «Откуда тянется». */
export const ORIGINS_UNLOCK_CASES = 5;

export interface MapCase {
  modeId: string;
  /** ISO-дата разбора (YYYY-MM-DD или полный ISO). */
  at: string;
}

export interface MapNote {
  modeId: string;
  alias?: string | null;
  /** Карточка примет собрана хотя бы частично. */
  hasCard: boolean;
}

export interface MapInput {
  cases: MapCase[];
  notes: MapNote[];
  /** Фразы Здорового Взрослого, собранные из ответов человека. */
  warmWords: string[];
  ysqDone: boolean;
  /** Сегодня, YYYY-MM-DD — время приходит снаружи, функция остаётся чистой. */
  today: string;
}

export interface MapModeItem {
  modeId: string;
  name: string;
  count: number;
  lastAt: string;
  hasCard: boolean;
  dormant: boolean;
  daysSince: number;
}

export interface MapLane {
  id: MapLaneId;
  title: string;
  items: MapModeItem[];
  /** Полоса рисуется на экране. */
  visible: boolean;
  locked: boolean;
}

/** Семьи режимов -> полоса карты. Копинги, гиперкомпенсации и критик выходят
 *  на сцену; детские режимы прячутся за ними; здоровые держат сверху. */
const LANE_BY_GROUP: Record<string, MapLaneId> = {
  ok: 'healthy',
  avoid: 'stage',
  surrender: 'stage',
  control: 'stage',
  grandiose: 'stage',
  critic: 'stage',
  hurt: 'backstage',
  anger: 'backstage',
};

const LANE_TITLES: Record<MapLaneId, string> = {
  healthy: 'Сверху: кто держит',
  stage: 'На сцене: кто выходит',
  backstage: 'За кулисами: кто прячется',
  origins: 'Откуда тянется',
};

/** Полоса режима; незнакомая семья уходит на сцену — там она хотя бы видна. */
export function laneForMode(modeId: string): MapLaneId {
  const group = findTestGroupByModeId(modeId);
  return (group && LANE_BY_GROUP[group.id]) ?? 'stage';
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso.slice(0, 10));
  const to = Date.parse(toIso.slice(0, 10));
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.max(0, Math.round((to - from) / 86400000));
}

/** Разборы -> строки карты, частые и свежие сверху. */
export function collectModeItems(input: MapInput): MapModeItem[] {
  const byMode = new Map<string, { count: number; lastAt: string }>();
  for (const c of input.cases) {
    const prev = byMode.get(c.modeId);
    if (!prev) byMode.set(c.modeId, { count: 1, lastAt: c.at });
    else
      byMode.set(c.modeId, {
        count: prev.count + 1,
        lastAt: c.at > prev.lastAt ? c.at : prev.lastAt,
      });
  }
  const noteByMode = new Map(input.notes.map((n) => [n.modeId, n]));
  // Карточка без единого разбора — тоже метка на карте: приметы могли быть
  // собраны раньше, чем поймался случай.
  for (const n of input.notes)
    if (!byMode.has(n.modeId)) byMode.set(n.modeId, { count: 0, lastAt: '' });

  const items: MapModeItem[] = [];
  for (const [modeId, stat] of byMode) {
    const note = noteByMode.get(modeId);
    const daysSince = stat.lastAt ? daysBetween(stat.lastAt, input.today) : 0;
    items.push({
      modeId,
      name: modeDisplayName(modeId, note?.alias),
      count: stat.count,
      lastAt: stat.lastAt,
      hasCard: note?.hasCard ?? false,
      dormant: stat.lastAt !== '' && daysSince >= DORMANT_AFTER_DAYS,
      daysSince,
    });
  }
  return items.sort((a, b) =>
    b.count !== a.count ? b.count - a.count : b.lastAt.localeCompare(a.lastAt),
  );
}

/**
 * Полосы карты. Полоса видна, когда в ней уже что-то есть, — кроме сцены:
 * она видна с первого разбора и держит экран, пока остальные пусты.
 */
export function buildMapLanes(input: MapInput): MapLane[] {
  const items = collectModeItems(input);
  const originsUnlocked =
    input.ysqDone || input.cases.length >= ORIGINS_UNLOCK_CASES;

  const lane = (id: MapLaneId): MapModeItem[] =>
    items.filter((i) => laneForMode(i.modeId) === id);

  const healthyItems = lane('healthy');
  const stageItems = lane('stage');
  const backstageItems = lane('backstage');

  return [
    {
      id: 'healthy',
      title: LANE_TITLES.healthy,
      items: healthyItems,
      visible: healthyItems.length > 0 || input.warmWords.length > 0,
      locked: false,
    },
    {
      id: 'stage',
      title: LANE_TITLES.stage,
      items: stageItems,
      visible: stageItems.length > 0 || items.length === 0,
      locked: false,
    },
    {
      id: 'backstage',
      title: LANE_TITLES.backstage,
      items: backstageItems,
      visible: backstageItems.length > 0 || stageItems.length > 0,
      locked: false,
    },
    {
      id: 'origins',
      title: LANE_TITLES.origins,
      items: [],
      visible: originsUnlocked || input.cases.length > 0,
      locked: !originsUnlocked,
    },
  ];
}
