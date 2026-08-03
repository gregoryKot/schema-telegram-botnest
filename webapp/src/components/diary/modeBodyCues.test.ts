// Правило №4: вход «не знаю, что чувствую» (MODE_UNKNOWN_GROUP) и реестр
// режимов (MODE_GROUPS) обязаны совпадать. Группа — вторая дверь к режимам,
// уже покрытым тестом modeTest (ALL_TEST_MODE_IDS), а не новый реестр —
// этот тест фиксирует и то, и другое, чтобы рассинхрон падал сразу.
import { describe, it, expect } from 'vitest';
import {
  MODE_UNKNOWN_GROUP,
  MODE_PICKER_GROUPS,
} from '../../../../shared/src/mode/modeBodyCues';
import {
  MODE_TEST_GROUPS,
  ALL_TEST_MODE_IDS,
} from '../../../../shared/src/mode/modeTest';
import { MODE_GROUPS } from '../../schemaTherapyData';

const REGISTRY_IDS = MODE_GROUPS.flatMap((g) => g.items.map((m) => m.id));

describe('modeBodyCues ↔ MODE_GROUPS синхронность', () => {
  it('каждый modeId листьев MODE_UNKNOWN_GROUP существует в MODE_GROUPS', () => {
    for (const leaf of MODE_UNKNOWN_GROUP.leaves) {
      expect(REGISTRY_IDS).toContain(leaf.modeId);
    }
  });

  it('modeId внутри группы уникальны', () => {
    const ids = MODE_UNKNOWN_GROUP.leaves.map((l) => l.modeId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("id 'unknown' не совпадает ни с одним id из MODE_TEST_GROUPS", () => {
    const testGroupIds = MODE_TEST_GROUPS.map((g) => g.id);
    expect(testGroupIds).not.toContain(MODE_UNKNOWN_GROUP.id);
  });

  it('MODE_PICKER_GROUPS = MODE_TEST_GROUPS + MODE_UNKNOWN_GROUP последним', () => {
    expect(MODE_PICKER_GROUPS.length).toBe(MODE_TEST_GROUPS.length + 1);
    expect(MODE_PICKER_GROUPS.at(-1)).toBe(MODE_UNKNOWN_GROUP);
  });

  it('каждый modeId листьев уже покрыт тестом (вторая дверь, не новый реестр)', () => {
    for (const leaf of MODE_UNKNOWN_GROUP.leaves) {
      expect(ALL_TEST_MODE_IDS).toContain(leaf.modeId);
    }
  });
});
