// Правило №4: тест определения режима и реестр режимов (MODE_GROUPS) обязаны
// совпадать. Любой лист теста должен указывать на реальный modeId, а каждый
// режим — быть достижим через тест (иначе новичок его не найдёт).
import { describe, it, expect } from 'vitest';
import {
  MODE_TEST_GROUPS,
  ALL_TEST_MODE_IDS,
  findTestGroupByModeId,
} from '../../../../shared/src/mode/modeTest';
import { MODE_GROUPS } from '../../schemaTherapyData';

const REGISTRY_IDS = MODE_GROUPS.flatMap((g) => g.items.map((m) => m.id));

describe('modeTest ↔ MODE_GROUPS синхронность', () => {
  it('каждый лист теста ссылается на существующий modeId', () => {
    for (const id of ALL_TEST_MODE_IDS) {
      expect(REGISTRY_IDS).toContain(id);
    }
  });

  it('каждый режим из реестра достижим через тест ровно один раз', () => {
    const sorted = [...ALL_TEST_MODE_IDS].sort();
    expect(sorted).toEqual([...REGISTRY_IDS].sort());
    // нет дублей
    expect(new Set(ALL_TEST_MODE_IDS).size).toBe(ALL_TEST_MODE_IDS.length);
  });

  it('findTestGroupByModeId находит семью для любого режима', () => {
    for (const id of REGISTRY_IDS) {
      expect(
        findTestGroupByModeId(id)?.leaves.some((l) => l.modeId === id),
      ).toBe(true);
    }
    expect(findTestGroupByModeId('nonexistent')).toBeUndefined();
  });

  it('у каждой группы теста есть эмодзи, заголовок и хотя бы один лист', () => {
    for (const g of MODE_TEST_GROUPS) {
      expect(g.emoji.length).toBeGreaterThan(0);
      expect(g.title.length).toBeGreaterThan(0);
      expect(g.leaves.length).toBeGreaterThan(0);
    }
  });
});
