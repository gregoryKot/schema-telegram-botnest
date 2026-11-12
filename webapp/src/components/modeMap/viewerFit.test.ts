import { describe, it, expect } from 'vitest';
import { READABLE_ZOOM, fitZoom, mainNodeId, viewerFitPlan } from './viewerFit';

describe('viewerFitPlan — начальный вид карты у клиента', () => {
  const phone = { w: 390, h: 650 };
  it('телефон: широкая карта целиком нечитаема — открываем фрагмент', () => {
    expect(fitZoom(phone, { w: 1000, h: 500 })).toBeLessThan(READABLE_ZOOM);
    expect(viewerFitPlan(phone, { w: 1000, h: 500 })).toBe('focus');
  });
  it('телефон: маленькая карта входит читаемой — показываем целиком', () => {
    expect(viewerFitPlan(phone, { w: 240, h: 300 })).toBe('all');
  });
  it('планшет и компьютер: всегда целиком', () => {
    expect(viewerFitPlan({ w: 768, h: 900 }, { w: 3000, h: 2000 })).toBe('all');
    expect(viewerFitPlan({ w: 1280, h: 800 }, { w: 1000, h: 500 })).toBe('all');
  });
  it('карта без размера (фигуры не измерены) не делит на ноль', () => {
    expect(fitZoom(phone, { w: 0, h: 0 })).toBe(1);
  });
});

describe('mainNodeId — главная фигура карты', () => {
  const nodes = [{ id: 't', type: 'trigger' }, { id: 'c', type: 'child' }, { id: 'p', type: 'coping' }];
  const edges = [{ source: 't', target: 'c' }, { source: 'c', target: 'p' }];
  it('фигура с наибольшим числом связей', () => {
    expect(mainNodeId(nodes, edges)).toBe('c');
  });
  it('колесо потребностей главнее числа связей', () => {
    expect(mainNodeId([...nodes, { id: 'w', type: 'needs' }], edges)).toBe('w');
  });
  it('без связей — первая фигура; пустая карта — undefined', () => {
    expect(mainNodeId(nodes, [])).toBe('t');
    expect(mainNodeId([], [])).toBeUndefined();
  });
});
