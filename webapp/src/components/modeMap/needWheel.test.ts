import { describe, it, expect } from 'vitest';
import { CX, CY, R, W } from '../../../../shared/src/components/needsWheelGeometry';
import {
  HEADER_H, WHEEL_PX, averageLabel, isWheel, needHandle, needOfHandle, noteOf, pctLabel, ratingsOf, sectorPoint,
  setNote, setRating, wheelEdgeType, wheelEnd, wheelPeriod, withChildhood,
} from './needWheel';

// Колесо потребностей на холсте (владелец 2026-11-10, лист Farrell & Shaw): данные по трём
// периодам, шкала 0–10 «Колеса детства», проценты на экране, линии к секторам.

describe('needWheel — данные колеса', () => {
  it('колесо — узел с data.wheel; старый круг-рамка — нет', () => {
    expect(isWheel({ wheel: {} })).toBe(true);
    expect(isWheel({})).toBe(false);
    expect(isWheel(undefined)).toBe(false);
  });

  it('по умолчанию на колесе «Сейчас»', () => {
    expect(wheelPeriod(undefined)).toBe('now');
    expect(wheelPeriod({ period: 'teen' })).toBe('teen');
  });

  it('оценки периода — только целые 0–10 и известные потребности; неоценённая — нет ключа, а не ноль', () => {
    const w = { ratings: { now: { attachment: 4, autonomy: 11, play: 2.5, limits: 0, junk: 3 } } };
    expect(ratingsOf(w, 'now')).toEqual({ attachment: 4, limits: 0 });
    expect(ratingsOf(w, 'child')).toEqual({});
  });

  it('оценка и текст пишутся по периоду и потребности, не задевая соседей; undefined и пустой текст стирают', () => {
    let w = setRating({}, 'child', 'attachment', 3);
    w = setRating(w, 'now', 'attachment', 7);
    w = setNote(w, 'teen', 'play', 'Спорт');
    expect(w).toEqual({ ratings: { child: { attachment: 3 }, now: { attachment: 7 } }, notes: { teen: { play: 'Спорт' } } });
    expect(noteOf(w, 'teen', 'play')).toBe('Спорт');
    expect(setRating(w, 'child', 'attachment', undefined).ratings?.child).toEqual({});
    expect(setNote(w, 'teen', 'play', '').notes?.teen).toEqual({});
  });

  it('«Колесо детства» клиента перекрывает детство, мусор отбрасывает, остальные периоды не трогает', () => {
    const w = { ratings: { child: { attachment: 9, limits: 2 }, now: { attachment: 5 } } };
    expect(withChildhood(w, { attachment: 3, play: 12, junk: 1 }).ratings).toEqual({
      child: { attachment: 3, limits: 2 }, now: { attachment: 5 },
    });
  });

  it('проценты: 0–10 → 0–100%, неоценённая — «—»; средний — только когда оценены все пять', () => {
    expect(pctLabel(7)).toBe('70%');
    expect(pctLabel(0)).toBe('0%');
    expect(pctLabel(undefined)).toBe('—');
    expect(averageLabel({ attachment: 5, autonomy: 6, expression: 4, play: 3, limits: 7 })).toBe('50%');
    expect(averageLabel({ attachment: 5 })).toBe('—');
  });
});

describe('needWheel — сектора и линии', () => {
  it('ручка сектора need:<id>; чужие ручки и неизвестные потребности — undefined', () => {
    expect(needOfHandle(needHandle('play'))).toBe('play');
    expect(needOfHandle('c')).toBeUndefined();
    expect(needOfHandle('need:junk')).toBeUndefined();
    expect(needOfHandle(null)).toBeUndefined();
  });

  it('край сектора «Привязанность» — верх колеса по центру; «Автономия» правее (по часовой)', () => {
    const scale = WHEEL_PX / W;
    expect(sectorPoint('attachment')).toEqual({ x: CX * scale, y: HEADER_H + (CY - R) * scale });
    expect(sectorPoint('autonomy').x).toBeGreaterThan(CX * scale);
  });

  it('конец линии у колеса — край сектора своей потребности в координатах холста; иначе null', () => {
    const node = { type: 'needs', internals: { positionAbsolute: { x: 100, y: 50 } } };
    const p = sectorPoint('limits');
    expect(wheelEnd(node, needHandle('limits'))).toEqual({ x: 100 + p.x, y: 50 + p.y });
    expect(wheelEnd(node, 'c')).toBeNull();
    expect(wheelEnd({ ...node, type: 'schema' }, needHandle('limits'))).toBeNull();
  });

  it('тип линии к сектору: от схемы — ✗, от здорового режима — ✓, от прочих — обычная', () => {
    expect(wheelEdgeType('schema')).toBe('blocks');
    expect(wheelEdgeType('healthy')).toBe('meets');
    expect(wheelEdgeType('child')).toBeUndefined();
  });
});
