// Правило №4: вход «не знаю, что чувствую» (MODE_UNKNOWN_GROUP) и реестр
// режимов (MODE_GROUPS) обязаны совпадать. Группа — вторая дверь к режимам,
// уже покрытым тестом modeTest (ALL_TEST_MODE_IDS), а не новый реестр —
// этот тест фиксирует и то, и другое, чтобы рассинхрон падал сразу.
import { describe, it, expect } from 'vitest';
import {
  MODE_UNKNOWN_GROUP,
  MODE_PICKER_GROUPS,
  SECOND_DOORS,
} from '../../../../shared/src/mode/modeBodyCues';
import {
  MODE_TEST_GROUPS,
  ALL_TEST_MODE_IDS,
  findTestGroupByModeId,
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

  it('MODE_PICKER_GROUPS = MODE_TEST_GROUPS (+ вторые входы) + MODE_UNKNOWN_GROUP последним', () => {
    expect(MODE_PICKER_GROUPS.length).toBe(MODE_TEST_GROUPS.length + 1);
    expect(MODE_PICKER_GROUPS.at(-1)).toBe(MODE_UNKNOWN_GROUP);

    for (const sourceGroup of MODE_TEST_GROUPS) {
      const pickerGroup = MODE_PICKER_GROUPS.find(
        (g) => g.id === sourceGroup.id,
      );
      const doors = SECOND_DOORS[sourceGroup.id];
      if (doors) {
        expect(pickerGroup?.leaves).toEqual([...sourceGroup.leaves, ...doors]);
      } else {
        expect(pickerGroup).toBe(sourceGroup);
      }
    }
  });

  it('каждый modeId листьев уже покрыт тестом (вторая дверь, не новый реестр)', () => {
    for (const leaf of MODE_UNKNOWN_GROUP.leaves) {
      expect(ALL_TEST_MODE_IDS).toContain(leaf.modeId);
    }
  });
});

// Инцидент 2026-08-03: свип по всем 35 режимам нашёл 5 режимов (включая уже
// известные angry_protector/bully_attack), чьё поверхностное переживание
// ведёт в другую дверь, чем их домашняя семья. SECOND_DOORS обобщает
// механизм вторых входов — дом (findTestGroupByModeId/modeChain) не меняется.
describe('SECOND_DOORS — вторые входы по семьям', () => {
  const doorEntries = Object.entries(SECOND_DOORS);

  it('каждый ключ SECOND_DOORS — существующий id семьи из MODE_TEST_GROUPS', () => {
    const testGroupIds = MODE_TEST_GROUPS.map((g) => g.id);
    for (const [familyId] of doorEntries) {
      expect(testGroupIds).toContain(familyId);
    }
  });

  it('каждый modeId листьев существует в реестре режимов и покрыт тестом (вторая дверь, не новый реестр)', () => {
    for (const [, leaves] of doorEntries) {
      for (const leaf of leaves) {
        expect(REGISTRY_IDS).toContain(leaf.modeId);
        expect(ALL_TEST_MODE_IDS).toContain(leaf.modeId);
      }
    }
  });

  it('modeId вторых входов не дублируют собственные листья своей семьи', () => {
    for (const [familyId, leaves] of doorEntries) {
      const sourceGroup = MODE_TEST_GROUPS.find((g) => g.id === familyId);
      const sourceIds = sourceGroup?.leaves.map((l) => l.modeId) ?? [];
      for (const leaf of leaves) {
        expect(sourceIds).not.toContain(leaf.modeId);
      }
    }
  });

  it('в MODE_PICKER_GROUPS соответствующая группа = домашние листья + SECOND_DOORS[id]', () => {
    for (const [familyId, leaves] of doorEntries) {
      const sourceGroup = MODE_TEST_GROUPS.find((g) => g.id === familyId);
      const pickerGroup = MODE_PICKER_GROUPS.find((g) => g.id === familyId);
      expect(pickerGroup?.leaves).toEqual([
        ...(sourceGroup?.leaves ?? []),
        ...leaves,
      ]);
    }
  });

  it('группы без вторых входов остаются той же ссылкой в MODE_PICKER_GROUPS', () => {
    for (const sourceGroup of MODE_TEST_GROUPS) {
      if (SECOND_DOORS[sourceGroup.id]) continue;
      const pickerGroup = MODE_PICKER_GROUPS.find(
        (g) => g.id === sourceGroup.id,
      );
      expect(pickerGroup).toBe(sourceGroup);
    }
  });

  it('emoji и label внутри расширенной группы уникальны', () => {
    for (const [familyId] of doorEntries) {
      const pickerGroup = MODE_PICKER_GROUPS.find((g) => g.id === familyId);
      const emojis = pickerGroup?.leaves.map((l) => l.emoji) ?? [];
      const labels = pickerGroup?.leaves.map((l) => l.label) ?? [];
      expect(new Set(emojis).size).toBe(emojis.length);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it('дом не изменился — findTestGroupByModeId/modeChain считают по MODE_TEST_GROUPS', () => {
    expect(findTestGroupByModeId('angry_protector')?.id).toBe('avoid');
    expect(findTestGroupByModeId('bully_attack')?.id).toBe('grandiose');
    expect(findTestGroupByModeId('flagellating_oc')?.id).toBe('control');
    expect(findTestGroupByModeId('pollyanna')?.id).toBe('grandiose');
    expect(findTestGroupByModeId('attention_seeker')?.id).toBe('grandiose');
    expect(findTestGroupByModeId('undisciplined_child')?.id).toBe('anger');
  });

  it('регрессия (инциденты 2026-08-03): вторые входы достижимы из своих дверей в пикере', () => {
    const idsOf = (familyId: string) =>
      MODE_PICKER_GROUPS.find((g) => g.id === familyId)?.leaves.map(
        (l) => l.modeId,
      ) ?? [];

    expect(idsOf('anger')).toContain('angry_protector');
    expect(idsOf('anger')).toContain('bully_attack');
    expect(idsOf('critic')).toContain('flagellating_oc');
    expect(idsOf('ok')).toContain('pollyanna');
    expect(idsOf('hurt')).toContain('attention_seeker');
    expect(idsOf('avoid')).toContain('undisciplined_child');
  });
});
