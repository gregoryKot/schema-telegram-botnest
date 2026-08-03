// Правило №4: вход «не знаю, что чувствую» (MODE_UNKNOWN_GROUP) и реестр
// режимов (MODE_GROUPS) обязаны совпадать. Группа — вторая дверь к режимам,
// уже покрытым тестом modeTest (ALL_TEST_MODE_IDS), а не новый реестр —
// этот тест фиксирует и то, и другое, чтобы рассинхрон падал сразу.
import { describe, it, expect } from 'vitest';
import {
  MODE_UNKNOWN_GROUP,
  MODE_PICKER_GROUPS,
  ANGER_SECOND_DOOR_LEAVES,
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

  it('MODE_PICKER_GROUPS = MODE_TEST_GROUPS + MODE_UNKNOWN_GROUP последним', () => {
    expect(MODE_PICKER_GROUPS.length).toBe(MODE_TEST_GROUPS.length + 1);
    expect(MODE_PICKER_GROUPS.at(-1)).toBe(MODE_UNKNOWN_GROUP);

    const sourceAnger = MODE_TEST_GROUPS.find((g) => g.id === 'anger');
    const pickerAnger = MODE_PICKER_GROUPS.find((g) => g.id === 'anger');
    expect(pickerAnger?.leaves).toEqual([
      ...(sourceAnger?.leaves ?? []),
      ...ANGER_SECOND_DOOR_LEAVES,
    ]);

    for (const sourceGroup of MODE_TEST_GROUPS) {
      if (sourceGroup.id === 'anger') continue;
      const pickerGroup = MODE_PICKER_GROUPS.find(
        (g) => g.id === sourceGroup.id,
      );
      expect(pickerGroup).toBe(sourceGroup);
    }
  });

  it('каждый modeId листьев уже покрыт тестом (вторая дверь, не новый реестр)', () => {
    for (const leaf of MODE_UNKNOWN_GROUP.leaves) {
      expect(ALL_TEST_MODE_IDS).toContain(leaf.modeId);
    }
  });
});

// Инцидент 2026-08-03: семья «Злюсь» теста и чипов «по ощущению» содержала
// только детские режимы — злость-копинги angry_protector (дом 'avoid') и
// bully_attack (дом 'grandiose') из двери «Злюсь» было не найти. Пикер даёт
// им вторые входы в семье 'anger', не меняя домашние семьи.
describe('вторые входы семьи Злюсь', () => {
  it('каждый modeId вторых входов существует в реестре режимов', () => {
    for (const leaf of ANGER_SECOND_DOOR_LEAVES) {
      expect(REGISTRY_IDS).toContain(leaf.modeId);
    }
  });

  it('каждый modeId вторых входов уже покрыт тестом (вторая дверь, не новый реестр)', () => {
    for (const leaf of ANGER_SECOND_DOOR_LEAVES) {
      expect(ALL_TEST_MODE_IDS).toContain(leaf.modeId);
    }
  });

  it('modeId вторых входов не дублируют собственные листья семьи anger', () => {
    const sourceAnger = MODE_TEST_GROUPS.find((g) => g.id === 'anger');
    const sourceIds = sourceAnger?.leaves.map((l) => l.modeId) ?? [];
    for (const leaf of ANGER_SECOND_DOOR_LEAVES) {
      expect(sourceIds).not.toContain(leaf.modeId);
    }
  });

  it('регрессия: angry_protector и bully_attack достижимы из группы anger в пикере', () => {
    const pickerAnger = MODE_PICKER_GROUPS.find((g) => g.id === 'anger');
    const pickerIds = pickerAnger?.leaves.map((l) => l.modeId) ?? [];
    expect(pickerIds).toContain('angry_protector');
    expect(pickerIds).toContain('bully_attack');
  });

  it('дом не изменился — findTestGroupByModeId/modeChain считают по MODE_TEST_GROUPS', () => {
    expect(findTestGroupByModeId('angry_protector')?.id).toBe('avoid');
    expect(findTestGroupByModeId('bully_attack')?.id).toBe('grandiose');
  });

  it('emoji листьев группы anger в пикере уникальны', () => {
    const pickerAnger = MODE_PICKER_GROUPS.find((g) => g.id === 'anger');
    const emojis = pickerAnger?.leaves.map((l) => l.emoji) ?? [];
    expect(new Set(emojis).size).toBe(emojis.length);
  });
});
