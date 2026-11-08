// Таблица вида сущностей (entityLook.ts, entityLookMaps.ts; словами — docs/design/APP_2026-11.md):
// то, что ломается молча, — сущность без вида, знак мимо реестра, оттенок мимо бумаги, две
// разные сущности с одним видом, соседние плитки почти одной бумаги, тип записи пути или
// быстрое действие без сущности, значок достижения не в цвет своей сущности.
import { describe, it, expect } from 'vitest';
import {
  ENTITY_LOOK,
  LOOK_FAMILY,
  PAPER_HUE,
  SIGN_KEYS,
  DONE_SCENES,
  MODE_GROUP_SIGN,
  modeGroupLook,
  domainLook,
  needLook,
  JOURNEY_ENTITY,
  journeyEntity,
  QUICK_ACTION_ENTITY,
  taskRouteEntity,
  DATA_KIND_ENTITY,
  dataKindEntity,
  ACHIEVEMENT_LOOK,
  achievementLook,
  OUTCOME_LOOK,
  type EntityId,
  type Look,
} from './entityLook';
import { DOMAIN_HUE, MODE_GROUP_HUE } from './entityHue';
import { JOURNEY_TYPE_META } from '../journey/journeyMeta';
import { QUICK_ACTION_IDS } from '../quickActions/quickActions';
import { QUICK_ACTIONS } from '../quickActions/quickActionsRegistry';
import { EXERCISES, type ExId } from '../exercises/exerciseCatalog';
import { NEED_ORDER } from '../needs/types';

const HUES = Object.values(PAPER_HUE) as number[];
const valid = (l: Look) =>
  HUES.includes(l.hue) && (SIGN_KEYS as readonly string[]).includes(l.sign);
const pair = (l: Look) => `${l.hue}/${l.sign}`;
const hue = (id: EntityId) => ENTITY_LOOK[id].hue;
/** Расстояние по кругу оттенков. */
const arc = (a: number, b: number) =>
  Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const ids = Object.keys(ENTITY_LOOK) as EntityId[];

/** Соседи в сетке из `cols` колонок: по строке и по столбцу. */
function gridNeighbours<T>(list: T[], cols: number): [T, T][] {
  const out: [T, T][] = [];
  list.forEach((x, i) => {
    if (i % cols !== cols - 1 && i + 1 < list.length)
      out.push([x, list[i + 1]]);
    if (i + cols < list.length) out.push([x, list[i + cols]]);
  });
  return out;
}

const EX: Record<ExId, EntityId> = {
  belief: 'belief_check',
  schema: 'schema_card',
  mode: 'mode_card',
  letter: 'letter',
  safe: 'safe_place',
  wheel: 'childhood_wheel',
  warm: 'warm_words',
  phrase: 'phrase_check',
};

describe('ENTITY_LOOK: одна сущность — один оттенок, один знак, одна сцена «готово»', () => {
  it('у каждой сущности из аудита есть вид', () => {
    const audited: EntityId[] = [
      'tracker',
      'note',
      'case',
      'diary',
      'gratitude',
      'schemas',
      'diary_schema',
      'schema_card',
      'ysq',
      'modes',
      'diary_mode',
      'mode_card',
      'breathing',
      'grounding',
      'stop',
      'sos',
      'belief_check',
      'letter',
      'safe_place',
      'childhood_wheel',
      'warm_words',
      'phrase_check',
      'nourish',
      'plan',
      'task',
      'profile',
      'journey',
      'portrait',
    ];
    for (const id of audited) expect(ENTITY_LOOK[id], id).toBeDefined();
    for (const e of EXERCISES)
      expect(ENTITY_LOOK[EX[e.id]], e.id).toBeDefined();
  });

  it('оттенок — бумага палитры, знак — из реестра, сцена «готово» — из списка сцен', () => {
    for (const id of ids) {
      const l = ENTITY_LOOK[id];
      expect(valid(l), id).toBe(true);
      expect(
        l.done === null || (DONE_SCENES as readonly string[]).includes(l.done),
        id,
      ).toBe(true);
    }
  });

  it('пары «оттенок + знак» не повторяются, кроме семьи вида (схемы вообще, режимы вообще)', () => {
    const head = (id: EntityId) => LOOK_FAMILY[id] ?? id;
    const byPair = new Map<string, Set<EntityId>>();
    for (const id of ids) {
      const key = pair(ENTITY_LOOK[id]);
      byPair.set(key, (byPair.get(key) ?? new Set()).add(head(id)));
    }
    for (const [key, heads] of byPair) expect([...heads], key).toHaveLength(1);
    for (const [member, h] of Object.entries(LOOK_FAMILY)) {
      expect(pair(ENTITY_LOOK[member as EntityId]), member).toBe(
        pair(ENTITY_LOOK[h]),
      );
      expect(LOOK_FAMILY[h], `${h} — глава семьи, не член`).toBeUndefined();
    }
  });

  it('опоры главной: трекер — солома + полоски, «Что случилось» — шалфей + лента, быстрая запись — персик + камешки', () => {
    expect(ENTITY_LOOK.tracker).toMatchObject({ hue: 70, sign: 'strokes' });
    expect(ENTITY_LOOK.case).toMatchObject({ hue: 135, sign: 'ribbon' });
    expect(ENTITY_LOOK.diary).toMatchObject({ hue: 45, sign: 'pebbles' });
  });

  it('соседние плитки — не ближе 40° по кругу: главная, практики, бенто библиотеки на 2 и 3 колонки', () => {
    const far = ([a, b]: [EntityId, EntityId]) =>
      expect(arc(hue(a), hue(b)), `${a}/${b}`).toBeGreaterThanOrEqual(40);
    gridNeighbours<EntityId>(['tracker', 'case', 'diary'], 3).forEach(far);
    gridNeighbours<EntityId>(['grounding', 'stop', 'sos'], 3).forEach(far);
    const library = EXERCISES.map((e) => EX[e.id]);
    gridNeighbours(library, 2).forEach(far);
    gridNeighbours(library, 3).forEach(far);
  });

  it('в «плюсе» соседние действия — разной бумаги', () => {
    const plus = QUICK_ACTIONS.filter((a) => a.surfaces.includes('plus')).map(
      (a) => hue(QUICK_ACTION_ENTITY[a.id]),
    );
    expect(plus.every((h, i) => i === 0 || h !== plus[i - 1])).toBe(true);
  });
});

describe('схема, режим, потребность — вид по домену, группе, потребности', () => {
  it('у каждой группы режимов свой знак, ключи — группы MODE_GROUP_HUE', () => {
    expect(Object.keys(MODE_GROUP_SIGN).sort()).toEqual(
      Object.keys(MODE_GROUP_HUE).sort(),
    );
    expect(new Set(Object.values(MODE_GROUP_SIGN)).size).toBe(
      Object.keys(MODE_GROUP_SIGN).length,
    );
    expect(modeGroupLook('critic')).toEqual({ hue: 310, sign: 'looming' });
    expect(modeGroupLook('healthy')).toEqual({ hue: 145, sign: 'together' });
  });

  it('режим без группы — общий знак режимов на бумаге «режимов вообще»', () => {
    const modes = { hue: ENTITY_LOOK.modes.hue, sign: 'cluster' };
    expect(modeGroupLook(undefined)).toEqual(modes);
    expect(modeGroupLook('own_mode')).toEqual(modes);
  });

  it('у каждого домена — бумага домена и его знак; незнакомый домен — без знака', () => {
    for (const [id, h] of Object.entries(DOMAIN_HUE))
      expect(domainLook(id)).toEqual({ hue: h, sign: `domain_${id}` });
    expect(domainLook('unknown')).toBeNull();
  });

  it('у каждой потребности — знак из реестра на бумаге палитры', () => {
    for (const id of NEED_ORDER) expect(valid(needLook(id)), id).toBe(true);
  });
});

describe('что → сущность: путь, быстрые действия, задания, перенос данных', () => {
  it('у каждого типа записи «Моего пути» есть сущность, незнакомый тип — без знака', () => {
    expect(Object.keys(JOURNEY_ENTITY).sort()).toEqual(
      Object.keys(JOURNEY_TYPE_META).sort(),
    );
    expect(journeyEntity('tracker_day')).toBe('tracker');
    expect(journeyEntity('flashcard')).toBe('sos');
    expect(journeyEntity('mystery')).toBeNull();
  });

  it('у каждого быстрого действия есть сущность', () => {
    expect(Object.keys(QUICK_ACTION_ENTITY).sort()).toEqual(
      [...QUICK_ACTION_IDS].sort(),
    );
    expect(ENTITY_LOOK[QUICK_ACTION_ENTITY.phrase_check].sign).toBe('looming');
  });

  it('задание: упражнение — его сущность, своё и неизвестное — «задание»', () => {
    expect(taskRouteEntity({ kind: 'exercise', exercise: 'safe_place' })).toBe(
      'safe_place',
    );
    expect(taskRouteEntity({ kind: 'exercise', exercise: 'flashcard' })).toBe(
      'sos',
    );
    expect(taskRouteEntity({ kind: 'tracker' })).toBe('tracker');
    expect(taskRouteEntity({ kind: 'schema', id: 'abandonment' })).toBe(
      'schema_card',
    );
    expect(taskRouteEntity({ kind: 'self' })).toBe('task');
    expect(taskRouteEntity({ kind: 'none' })).toBe('task');
  });

  it('таблица переноса — сущность из ENTITY_LOOK; дневники — камешки; незнакомая таблица — без знака', () => {
    for (const [t, id] of Object.entries(DATA_KIND_ENTITY))
      expect(ENTITY_LOOK[id], t).toBeDefined();
    for (const t of [
      'SchemaDiaryEntry',
      'ModeDiaryEntry',
      'GratitudeDiaryEntry',
      'Note',
    ])
      expect(ENTITY_LOOK[DATA_KIND_ENTITY[t]].sign, t).toBe('pebbles');
    expect(dataKindEntity('Rating')).toBe('tracker');
    expect(dataKindEntity('toString')).toBeNull();
  });
});

describe('достижения и исходы служебных страниц', () => {
  it('значок достижения — вид сущности своего знака (или потребности), не свой цвет', () => {
    const known = new Set([
      ...ids.map((id) => pair(ENTITY_LOOK[id])),
      ...NEED_ORDER.map((n) => pair(needLook(n))),
    ]);
    for (const [id, l] of Object.entries(ACHIEVEMENT_LOOK)) {
      expect(valid(l), id).toBe(true);
      expect(known.has(pair(l)), `${id}: ${pair(l)}`).toBe(true);
    }
    expect(achievementLook('streak_7')).toEqual({ hue: 70, sign: 'strokes' });
    expect(achievementLook('hasOwnProperty')).toBeNull();
  });

  it('исходы: готово — галочка на шалфее, граница — рамка на небе, подожди — чашка на соломе; виды не повторяются', () => {
    const list = Object.values(OUTCOME_LOOK);
    for (const l of list) expect(valid(l), pair(l)).toBe(true);
    expect(new Set(list.map(pair)).size).toBe(list.length);
    expect(OUTCOME_LOOK.done).toEqual({ hue: 135, sign: 'check' });
    expect(OUTCOME_LOOK.limit).toEqual({ hue: 240, sign: 'limits' });
    expect(OUTCOME_LOOK.wait).toEqual({ hue: 70, sign: 'cup' });
    expect(OUTCOME_LOOK.our_side).toEqual({ hue: 45, sign: 'breath' });
  });
});
