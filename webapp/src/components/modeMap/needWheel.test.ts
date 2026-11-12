import { describe, it, expect } from 'vitest';
import { CY, R, W } from '../../../../shared/src/components/needsWheelGeometry';
import {
  HEADER_H, WHEEL_NODE_W, averageLabel, isWheel, labelSide, needHandle, needOfHandle, sectorPoint, wheelEdgeType, wheelEnd, wheelPeriod,
} from './needWheel';

// Колесо потребностей на холсте: вид узла (период, подписи) и геометрия секторов и линий.
// Оценки и тексты — в концептуализации клиента, их правки проверяет wheelData.test.ts.

describe('needWheel — вид узла', () => {
  it('колесо — узел с data.wheel; старый круг-рамка — нет', () => {
    expect(isWheel({ wheel: {} })).toBe(true);
    expect(isWheel({})).toBe(false);
    expect(isWheel(undefined)).toBe(false);
  });

  it('по умолчанию на колесе «Сейчас»', () => {
    expect(wheelPeriod(undefined)).toBe('now');
    expect(wheelPeriod({ period: 'teen' })).toBe('teen');
  });

  it('средний процент — только когда оценены все пять, иначе «—»', () => {
    expect(averageLabel({ attachment: 5, autonomy: 6, expression: 4, play: 3, limits: 7 })).toBe('50%');
    expect(averageLabel({ attachment: 5 })).toBe('—');
  });

  it('подпись сектора: верхний — над колесом, правые — справа, левые — слева', () => {
    expect(labelSide('attachment')).toBe('top');
    expect(labelSide('autonomy')).toBe('right');
    expect(labelSide('expression')).toBe('right');
    expect(labelSide('play')).toBe('left');
    expect(labelSide('limits')).toBe('left');
  });
});

describe('needWheel — сектора и линии', () => {
  it('ручка сектора need:<id>; чужие ручки и неизвестные потребности — undefined', () => {
    expect(needOfHandle(needHandle('play'))).toBe('play');
    expect(needOfHandle('c')).toBeUndefined();
    expect(needOfHandle('need:junk')).toBeUndefined();
    expect(needOfHandle(null)).toBeUndefined();
  });

  it('край сектора «Привязанность» — верх колеса по центру узла; «Автономия» правее, «Границы» левее', () => {
    // колесо рисуется в масштабе 1:1 (ширина рисунка = W геометрии), по центру узла под шапкой
    expect(sectorPoint('attachment')).toEqual({ x: WHEEL_NODE_W / 2, y: HEADER_H + (CY - R) });
    expect(sectorPoint('autonomy').x).toBeGreaterThan(WHEEL_NODE_W / 2);
    expect(sectorPoint('limits').x).toBeLessThan(WHEEL_NODE_W / 2);
    expect(WHEEL_NODE_W).toBeGreaterThan(W); // по бокам — поля под подписи секторов
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
