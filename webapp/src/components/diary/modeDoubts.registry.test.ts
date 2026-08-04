// Правило №4: реестр «с чем путают режим» (shared/mode/modeDoubts) и MODE_GROUPS
// обязаны совпадать — каждый id из пары должен указывать на реальный режим,
// иначе карточка «Сомневаешься?» сошлётся на несуществующий modeId.
// Зеркало schema-miniapp/src/components/diary/modeDoubts.registry.test.ts (правило №3).
import { describe, it, expect } from 'vitest';
import { MODE_DOUBT_PAIRS } from '../../../../shared/src/mode/modeDoubts';
import { MODE_GROUPS } from '../../schemaTherapyData';

const REGISTRY_IDS = new Set(
  MODE_GROUPS.flatMap((g) => g.items.map((m) => m.id)),
);

describe('modeDoubts ↔ MODE_GROUPS синхронность (webapp)', () => {
  it('ровно 38 пар в реестре', () => {
    expect(MODE_DOUBT_PAIRS).toHaveLength(38);
  });

  it('каждый id из MODE_DOUBT_PAIRS существует в MODE_GROUPS', () => {
    for (const pair of MODE_DOUBT_PAIRS) {
      expect(REGISTRY_IDS.has(pair.a), `a: ${pair.a}`).toBe(true);
      expect(REGISTRY_IDS.has(pair.b), `b: ${pair.b}`).toBe(true);
    }
  });
});
