// Знак записи у терапевта — тот же, что в ленте «Записи» клиента (принцип 10): сверка с ENTITY_LOOK и feedLook.
import { describe, it, expect } from 'vitest';
import { noteLook } from './noteLook';
import { kindLook } from '../../sections/diary/feedLook';

describe('noteLook', () => {
  it('дневник схем — Layers на глине, дневник режимов — Cluster на небе', () => {
    expect(noteLook('schema')).toEqual({ hue: 28, sign: 'layers' });
    expect(noteLook('mode')).toEqual({ hue: 240, sign: 'cluster' });
  });

  it('благодарность — Pebbles filled на бирюзе, быстрая запись — Pebbles на персике', () => {
    expect(noteLook('gratitude')).toEqual({ hue: 195, sign: 'pebbles', filled: true });
    expect(noteLook('quick')).toEqual({ hue: 45, sign: 'pebbles' });
  });

  it('оттенки и знаки совпадают с лентой клиента (feedLook)', () => {
    expect(noteLook('schema')).toMatchObject(kindLook('schema'));
    expect(noteLook('gratitude')).toMatchObject(kindLook('gratitude'));
    expect(noteLook('quick')).toMatchObject(kindLook('thought'));
    expect(noteLook('mode')).toMatchObject(kindLook('mode'));
  });
});
