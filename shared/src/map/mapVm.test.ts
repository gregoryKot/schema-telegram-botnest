/**
 * Сборка карты себя из разборов.
 *
 * Главное, что проверяем, — карта не наказывает за пропуски: затихший режим
 * гаснет, но не исчезает и не обнуляет счётчик, а пустая полоса просто не
 * рисуется вместо того, чтобы висеть укором. Даты в тестах относительные —
 * абсолютные протухнут (правило тестов проекта).
 */
import { describe, it, expect } from 'vitest';
import {
  buildMapLanes,
  collectModeItems,
  laneForMode,
  DORMANT_AFTER_DAYS,
  ORIGINS_UNLOCK_CASES,
  type MapInput,
} from './mapVm';

const TODAY = '2026-08-28';

function daysAgo(n: number): string {
  const d = new Date(Date.parse(TODAY) - n * 86400000);
  return d.toISOString().slice(0, 10);
}

function input(over: Partial<MapInput> = {}): MapInput {
  return {
    cases: [],
    notes: [],
    warmWords: [],
    ysqDone: false,
    today: TODAY,
    ...over,
  };
}

describe('laneForMode', () => {
  it('копинг выходит на сцену, детский режим прячется за кулисами', () => {
    expect(laneForMode('detached_protector')).toBe('stage');
    expect(laneForMode('vulnerable_child')).toBe('backstage');
    expect(laneForMode('angry_child')).toBe('backstage');
  });

  it('здоровые режимы держат сверху', () => {
    expect(laneForMode('healthy_adult')).toBe('healthy');
    expect(laneForMode('happy_child')).toBe('healthy');
  });

  it('критик и гиперкомпенсация — тоже сцена', () => {
    expect(laneForMode('punitive_critic')).toBe('stage');
    expect(laneForMode('self_aggrandiser')).toBe('stage');
  });

  it('незнакомый режим не теряется — уходит на сцену', () => {
    expect(laneForMode('mode_which_does_not_exist')).toBe('stage');
  });
});

describe('collectModeItems', () => {
  it('считает случаи и запоминает последний', () => {
    const items = collectModeItems(
      input({
        cases: [
          { modeId: 'detached_protector', at: daysAgo(5) },
          { modeId: 'detached_protector', at: daysAgo(1) },
          { modeId: 'angry_child', at: daysAgo(3) },
        ],
      }),
    );
    const wall = items.find((i) => i.modeId === 'detached_protector')!;
    expect(wall.count).toBe(2);
    expect(wall.lastAt).toBe(daysAgo(1));
  });

  it('своё имя попадает в карту из карточки', () => {
    const items = collectModeItems(
      input({
        cases: [{ modeId: 'detached_protector', at: daysAgo(1) }],
        notes: [
          { modeId: 'detached_protector', alias: 'Стена', hasCard: true },
        ],
      }),
    );
    expect(items[0].name).toBe('Стена');
    expect(items[0].hasCard).toBe(true);
  });

  it('карточка без единого разбора — тоже метка на карте', () => {
    const items = collectModeItems(
      input({ notes: [{ modeId: 'angry_child', hasCard: true }] }),
    );
    expect(items).toHaveLength(1);
    expect(items[0].count).toBe(0);
    expect(items[0].dormant).toBe(false);
  });

  it('затихший режим гаснет, но счётчик не обнуляется', () => {
    const items = collectModeItems(
      input({
        cases: [
          { modeId: 'detached_protector', at: daysAgo(DORMANT_AFTER_DAYS + 2) },
          { modeId: 'detached_protector', at: daysAgo(DORMANT_AFTER_DAYS + 1) },
        ],
      }),
    );
    expect(items[0].dormant).toBe(true);
    expect(items[0].count).toBe(2);
    expect(items[0].daysSince).toBeGreaterThanOrEqual(DORMANT_AFTER_DAYS);
  });

  it('свежий режим не гаснет', () => {
    const items = collectModeItems(
      input({ cases: [{ modeId: 'detached_protector', at: daysAgo(2) }] }),
    );
    expect(items[0].dormant).toBe(false);
  });

  it('частый режим стоит выше редкого', () => {
    const items = collectModeItems(
      input({
        cases: [
          { modeId: 'angry_child', at: daysAgo(2) },
          { modeId: 'detached_protector', at: daysAgo(3) },
          { modeId: 'detached_protector', at: daysAgo(4) },
        ],
      }),
    );
    expect(items[0].modeId).toBe('detached_protector');
  });

  it('битая дата не роняет сборку', () => {
    const items = collectModeItems(
      input({ cases: [{ modeId: 'angry_child', at: 'не-дата' }] }),
    );
    expect(items).toHaveLength(1);
    expect(items[0].daysSince).toBe(0);
  });
});

describe('buildMapLanes', () => {
  it('на чистой карте видна только сцена — трёх пустых рамок нет', () => {
    const lanes = buildMapLanes(input());
    const visible = lanes.filter((l) => l.visible).map((l) => l.id);
    expect(visible).toEqual(['stage']);
  });

  it('полоса «сверху» открывается вместе с первой тёплой фразой', () => {
    const lanes = buildMapLanes(input({ warmWords: ['Побудь, я рядом'] }));
    expect(lanes.find((l) => l.id === 'healthy')!.visible).toBe(true);
  });

  it('кулисы открываются, как только на сцене кто-то есть', () => {
    const lanes = buildMapLanes(
      input({ cases: [{ modeId: 'detached_protector', at: daysAgo(1) }] }),
    );
    expect(lanes.find((l) => l.id === 'backstage')!.visible).toBe(true);
    expect(lanes.find((l) => l.id === 'backstage')!.items).toHaveLength(0);
  });

  it('«откуда тянется» заперта до пяти разборов', () => {
    const four = Array.from({ length: ORIGINS_UNLOCK_CASES - 1 }, (_, i) => ({
      modeId: 'detached_protector',
      at: daysAgo(i + 1),
    }));
    expect(
      buildMapLanes(input({ cases: four })).find((l) => l.id === 'origins')!
        .locked,
    ).toBe(true);
  });

  it('пятый разбор открывает «откуда тянется»', () => {
    const five = Array.from({ length: ORIGINS_UNLOCK_CASES }, (_, i) => ({
      modeId: 'detached_protector',
      at: daysAgo(i + 1),
    }));
    expect(
      buildMapLanes(input({ cases: five })).find((l) => l.id === 'origins')!
        .locked,
    ).toBe(false);
  });

  it('пройденный тест открывает «откуда тянется» без пяти разборов', () => {
    expect(
      buildMapLanes(input({ ysqDone: true })).find((l) => l.id === 'origins')!
        .locked,
    ).toBe(false);
  });

  it('режимы расходятся по своим полосам', () => {
    const lanes = buildMapLanes(
      input({
        cases: [
          { modeId: 'detached_protector', at: daysAgo(1) },
          { modeId: 'vulnerable_child', at: daysAgo(2) },
          { modeId: 'happy_child', at: daysAgo(3) },
        ],
      }),
    );
    const ids = (l: string) =>
      lanes.find((x) => x.id === l)!.items.map((i) => i.modeId);
    expect(ids('stage')).toEqual(['detached_protector']);
    expect(ids('backstage')).toEqual(['vulnerable_child']);
    expect(ids('healthy')).toEqual(['happy_child']);
  });
});
