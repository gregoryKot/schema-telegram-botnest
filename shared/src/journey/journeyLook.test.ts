// Вид шага «Моего пути» — один источник для ленты, плитки счётчика и детали (b22-journey).
// Сверка (правило №4): у каждого типа шага из реестра journeyMeta есть знак из SIGN_KEYS и бумага
// палитры; шаг на одну потребность — её вид; режим — небо и знак группы; незнакомое — без знака.
import { describe, it, expect } from 'vitest';
import { JOURNEY_TYPE_META } from './journeyMeta';
import {
  CHILDHOOD_LOOK,
  CHILDHOOD_STAT,
  JOURNEY_LOOK,
  JOURNEY_NEED_LOOK,
  isHealthyPart,
  journeyItemLook,
  journeyStatLook,
} from './journeyLook';
import {
  ENTITY_LOOK,
  JOURNEY_ENTITY,
  PAPER_HUE,
  SIGN_KEYS,
  needLook,
} from '../theme/entityLook';
import { NEED_ORDER } from '../needs/types';
import { journeyStatRows } from './journeyStats';
import { EMPTY_JOURNEY_COUNTS } from './journeyCounts.fixture';
import { canvasSign } from '../share/kit/signs';

const HUES = Object.values(PAPER_HUE) as number[];

describe('литеральные таблицы вида сверены с ENTITY_LOOK (правило №4)', () => {
  it('JOURNEY_LOOK — вид сущности JOURNEY_ENTITY каждого типа', () => {
    const want = Object.fromEntries(
      Object.entries(JOURNEY_ENTITY).map(([type, e]) => [
        type,
        { hue: ENTITY_LOOK[e].hue, sign: ENTITY_LOOK[e].sign },
      ]),
    );
    expect(JOURNEY_LOOK).toEqual(want);
  });

  it('JOURNEY_NEED_LOOK — needLook каждой потребности; колесо детства — его сущность', () => {
    expect(JOURNEY_NEED_LOOK).toEqual(
      Object.fromEntries(NEED_ORDER.map((id) => [id, needLook(id)])),
    );
    const { hue, sign } = ENTITY_LOOK.childhood_wheel;
    expect(CHILDHOOD_LOOK).toEqual({ hue, sign });
  });
});

describe('journeyItemLook', () => {
  it('у каждого типа шага есть знак и бумага палитры', () => {
    for (const type of Object.keys(JOURNEY_TYPE_META)) {
      const look = journeyItemLook({ type });
      expect(look, type).not.toBeNull();
      expect(SIGN_KEYS, type).toContain(look!.sign);
      expect(HUES, type).toContain(look!.hue);
    }
  });

  it('вид строки — вид сущности: дыхание Breath, шаг плана Check, кризисная карточка Heart', () => {
    expect(journeyItemLook({ type: 'breathing' })).toEqual({
      hue: 195,
      sign: 'breath',
    });
    expect(journeyItemLook({ type: 'plan_done' })).toEqual({
      hue: 135,
      sign: 'check',
    });
    expect(journeyItemLook({ type: 'flashcard' })).toEqual({
      hue: 25,
      sign: 'heart',
    });
    expect(journeyItemLook({ type: 'practice' })).toEqual({
      hue: 145,
      sign: 'leaf',
    });
  });

  it('шаг на одну потребность — бумага и знак потребности; неизвестная потребность — вид сущности', () => {
    expect(journeyItemLook({ type: 'practice', needId: 'autonomy' })).toEqual(
      needLook('autonomy'),
    );
    expect(journeyItemLook({ type: 'plan_done', needId: 'limits' })).toEqual(
      needLook('limits'),
    );
    expect(journeyItemLook({ type: 'practice', needId: 'xxx' })).toEqual({
      hue: 145,
      sign: 'leaf',
    });
    // потребность у трекера — подпись строки, а не вид
    expect(journeyItemLook({ type: 'tracker_day', needId: 'play' })).toEqual({
      hue: 70,
      sign: 'strokes',
    });
  });

  it('режим — небо режимов и знак группы; без функции группы — Cluster', () => {
    const sign = () => 'looming' as const;
    expect(
      journeyItemLook({ type: 'mode_diary', modeId: 'punitive_critic' }, sign),
    ).toEqual({ hue: 240, sign: 'looming' });
    expect(journeyItemLook({ type: 'mode_note', modeId: 'x' }, sign)).toEqual({
      hue: 240,
      sign: 'looming',
    });
    expect(journeyItemLook({ type: 'mode_diary', modeId: 'x' })).toEqual({
      hue: 240,
      sign: 'cluster',
    });
    // режим у не-режимного шага не меняет вид
    expect(journeyItemLook({ type: 'note', modeId: 'x' }, sign)).toEqual({
      hue: 70,
      sign: 'pebbles',
    });
  });

  it('незнакомый тип с бэка — null, без выдуманного знака', () => {
    expect(journeyItemLook({ type: 'new_type' })).toBeNull();
  });
});

describe('journeyStatLook', () => {
  it('у каждой плитки счётчика есть знак, включая колесо детства', () => {
    const all = Object.fromEntries(
      Object.keys(EMPTY_JOURNEY_COUNTS).map((k) => [
        k,
        k === 'childhoodDone' || k === 'safePlace' ? true : 1,
      ]),
    ) as unknown as typeof EMPTY_JOURNEY_COUNTS;
    const rows = journeyStatRows(all);
    expect(rows.length).toBe(Object.keys(JOURNEY_TYPE_META).length + 1);
    for (const r of rows)
      expect(journeyStatLook(r.type), r.label).not.toBeNull();
    const { hue, sign } = ENTITY_LOOK.childhood_wheel;
    expect(journeyStatLook(CHILDHOOD_STAT)).toEqual({ hue, sign });
  });
});

describe('isHealthyPart', () => {
  it('голос Здорового Взрослого — «Здоровый взгляд» и «Здоровый Взрослый», не «Здоровое поведение»', () => {
    expect(isHealthyPart('Здоровый взгляд')).toBe(true);
    expect(isHealthyPart('Здоровый Взрослый')).toBe(true);
    expect(isHealthyPart('Здоровое поведение')).toBe(false);
    expect(isHealthyPart(undefined)).toBe(false);
  });
});

describe('карточки шаринга рисуют знак каждого шага (b23b)', () => {
  it.each(Object.keys(JOURNEY_TYPE_META))(
    'у типа %s есть знак на canvas',
    (type) => {
      const look = journeyItemLook({ type });
      expect(look).not.toBeNull();
      expect(canvasSign(look!.sign)).toBe(look!.sign);
    },
  );

  it('у шага на потребность и у колеса детства — тоже', () => {
    for (const l of [...Object.values(JOURNEY_NEED_LOOK), CHILDHOOD_LOOK])
      expect(canvasSign(l.sign)).toBe(l.sign);
  });
});
