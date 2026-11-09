import { describe, it, expect } from 'vitest';
import { buildMapLanes, type MapInput } from '../../../../shared/src/map/mapVm';
import { buildStage, isEmptyStage, partRadius, STAGE_MAX } from './selfMapStage';

const today = '2026-11-09';
const base: MapInput = { cases: [], notes: [], warmWords: [], ysqDone: false, today };
const groups: Record<string, string> = {
  punitive_critic: 'critic',
  detached_protector: 'coping_avoidance',
  vulnerable_child: 'child',
  healthy_adult: 'healthy',
};
const groupOf = (id: string) => groups[id];
const stageOf = (input: Partial<MapInput>) => buildStage(buildMapLanes({ ...base, ...input }), groupOf);

describe('buildStage — сцена «Карты себя» из реальных разборов', () => {
  it('пустая карта — пустая сцена, без выдуманных кругов', () => {
    const m = stageOf({});
    expect(isEmptyStage(m)).toBe(true);
  });

  it('режим из разбора выходит на сцену своим цветом группы; детский прячется за кулисами', () => {
    const m = stageOf({
      cases: [
        { modeId: 'punitive_critic', at: '2026-11-08' },
        { modeId: 'punitive_critic', at: '2026-11-07' },
        { modeId: 'vulnerable_child', at: '2026-11-06' },
      ],
    });
    expect(m.stage).toEqual([{ modeId: 'punitive_critic', r: partRadius(2), ink: 'plum', dormant: false }]);
    expect(m.backstage.map((p) => [p.modeId, p.ink])).toEqual([['vulnerable_child', 'clay']]);
    expect(m.holding).toEqual([]);
  });

  it('частый режим — крупнее; радиус растёт до потолка и не уходит ниже кружка примет', () => {
    expect(partRadius(0)).toBe(14);
    expect(partRadius(1)).toBeLessThan(partRadius(3));
    expect(partRadius(40)).toBe(partRadius(4));
  });

  it('затихший режим гаснет, а не исчезает', () => {
    const m = stageOf({ cases: [{ modeId: 'detached_protector', at: '2026-09-01' }] });
    expect(m.stage[0]).toMatchObject({ modeId: 'detached_protector', ink: 'slate', dormant: true });
  });

  it('режим без группы (свой) — сланец, а не выдуманный цвет', () => {
    const m = stageOf({ cases: [{ modeId: 'custom_x', at: '2026-11-08' }] });
    expect(m.stage[0].ink).toBe('slate');
  });

  it('на сцене не больше, чем помещается; остальное — строками под сценой', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const m = stageOf({ cases: ids.map((modeId) => ({ modeId, at: '2026-11-08' })) });
    expect(m.stage).toHaveLength(STAGE_MAX.stage);
  });
});
