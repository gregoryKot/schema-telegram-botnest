// modeNodeType / findModeMeta — какой фигурой режим рисуется на карте. Один
// источник для палитры («Режимы клиента») и для переноса схемы случая; проверяем
// по настоящим группам режимов, а не по выдуманному списку.
import { describe, it, expect } from 'vitest';
import { MODE_GROUPS } from '../../schemaTherapyData';
import { GROUP_TO_TYPE } from '../modeMapData';
import { findModeMeta, modeNodeType } from './modeNodeMeta';

describe('modeNodeType', () => {
  it.each([
    ['vulnerable_child', 'child', undefined],
    ['punitive_critic', 'critic', undefined],
    ['healthy_adult', 'healthy', undefined],
    ['detached_protector', 'coping', 'avoid'],
    ['compliant_surrenderer', 'coping', 'surr'],
    ['self_aggrandiser', 'coping', 'over'],
  ])('%s → %s %s', (modeId, type, copingSubtype) => {
    const got = modeNodeType(modeId);
    expect(got.type).toBe(type);
    expect(got.copingSubtype).toBe(copingSubtype);
  });

  it('режим вне групп рисуется как «свой» без подтипа копинга', () => {
    expect(modeNodeType('нет_такого')).toEqual({ type: 'custom' });
  });

  it('у режима не-копинга ключа copingSubtype нет вовсе (в data карты не попадает undefined)', () => {
    expect(modeNodeType('vulnerable_child')).not.toHaveProperty('copingSubtype');
  });

  it('каждый режим каждой группы палитры получает тип своей группы', () => {
    for (const group of MODE_GROUPS) {
      const meta = GROUP_TO_TYPE[group.id];
      if (!meta) continue;
      for (const item of group.items) {
        expect(modeNodeType(item.id).type, item.id).toBe(meta.type);
        expect(findModeMeta(item.id)?.name, item.id).toBe(item.name);
      }
    }
  });
});
