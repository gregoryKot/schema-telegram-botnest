// modeMapData.ts — реестр цветов/размеров/типов узла карты режимов. 0%
// покрытия. Пиновка инвариантов реестра: набор типов узла совпадает с
// ModeMapNode['type'] из api.types.ts (иначе NODE_TYPES/легенда молча
// потеряют тип), а GROUP_TO_TYPE (палитра drag&drop) ссылается только на
// существующие цвета/типы.
import { describe, it, expect } from 'vitest';
import { TYPE_COLORS, NODE_DEFAULT_SIZES, DRAG_TYPE, GROUP_TO_TYPE, type NodeType } from './modeMapData';

// Держим руками синхронизированный список — если кто-то добавит тип узла в
// api.types.ts и забудет завести цвет здесь, этот тест покажет расхождение.
const KNOWN_NODE_TYPES: NodeType[] = ['trigger', 'child', 'critic', 'coping', 'healthy', 'custom', 'behavior'];

describe('TYPE_COLORS', () => {
  it('содержит цвет ровно для каждого известного типа узла — не больше, не меньше', () => {
    expect(new Set(Object.keys(TYPE_COLORS))).toEqual(new Set(KNOWN_NODE_TYPES));
  });

  it('каждый цвет — непустая CSS var() ссылка на палитру сайта', () => {
    for (const [type, color] of Object.entries(TYPE_COLORS)) {
      expect(color.length, type).toBeGreaterThan(0);
      expect(color, type).toMatch(/^var\(--c-[\w-]+\)$/);
    }
  });

  it('copingSubtype-варианты (гипер/избегание/капитуляция) делят один цвет — их различает форма, не цвет', () => {
    // Документирует намеренное решение из комментария в исходнике: если кто-то
    // случайно заведёт три разных цвета для coping, тест это поймает.
    expect(TYPE_COLORS.coping).toBe('var(--c-clay)');
  });
});

describe('DRAG_TYPE', () => {
  it('непустая MIME-подобная строка для dataTransfer', () => {
    expect(DRAG_TYPE.length).toBeGreaterThan(0);
    expect(DRAG_TYPE).toContain('/');
  });
});

describe('GROUP_TO_TYPE', () => {
  it('каждая группа палитры ссылается на существующий тип узла из TYPE_COLORS', () => {
    for (const [group, meta] of Object.entries(GROUP_TO_TYPE)) {
      expect(KNOWN_NODE_TYPES, group).toContain(meta.type);
    }
  });

  it('цвет группы совпадает с TYPE_COLORS её типа (нет рассинхрона реестров)', () => {
    for (const [group, meta] of Object.entries(GROUP_TO_TYPE)) {
      expect(meta.color, group).toBe(TYPE_COLORS[meta.type]);
    }
  });

  it('coping_* группы несут разный copingSubtype (surr/avoid/over — не дублируются)', () => {
    const copingGroups = Object.entries(GROUP_TO_TYPE).filter(([, m]) => m.type === 'coping');
    const subtypes = copingGroups.map(([, m]) => m.copingSubtype);
    expect(new Set(subtypes).size).toBe(subtypes.length);
    expect(subtypes.sort()).toEqual(['avoid', 'over', 'surr']);
  });

  it('не-coping группы не несут copingSubtype', () => {
    for (const [group, meta] of Object.entries(GROUP_TO_TYPE)) {
      if (meta.type !== 'coping') expect(meta.copingSubtype, group).toBeUndefined();
    }
  });
});

describe('NODE_DEFAULT_SIZES', () => {
  it('любая заданная запись имеет положительные width/height (узлы иначе схлопнутся в точку)', () => {
    for (const [type, size] of Object.entries(NODE_DEFAULT_SIZES)) {
      if (!size) continue;
      expect(size.width, type).toBeGreaterThan(0);
      expect(size.height, type).toBeGreaterThan(0);
    }
  });
});
