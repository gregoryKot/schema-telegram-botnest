// Правило №4: вход «не знаю, что чувствую» (MODE_UNKNOWN_GROUP) и реестр
// режимов (MODE_GROUPS) обязаны совпадать. Группа — вторая дверь к режимам,
// уже покрытым тестом modeTest (ALL_TEST_MODE_IDS), а не новый реестр —
// этот тест фиксирует и то, и другое, чтобы рассинхрон падал сразу.
//
// Ворота пикера (MODE_PICKER_GROUPS/FEEL_GATES, 8 ворот «по базовому
// чувству») и getModeLeafLabel переехали в shared/mode/modeFeelGates.ts —
// полное покрытие 35/35 и регрессии кросс-входов там (modeFeelGates.test.ts,
// не дублируется во фронтендах). Здесь остаётся то, чего в shared нет: сверка
// с фронтендовым реестром MODE_GROUPS (schemaTherapyData) + контрольная
// проверка, что модуль ворот собран из shared-данных.
import { describe, it, expect } from 'vitest';
import {
  MODE_UNKNOWN_GROUP,
  SECOND_DOORS,
} from '../../../../shared/src/mode/modeBodyCues';
import {
  FEEL_GATES,
  MODE_PICKER_GROUPS,
} from '../../../../shared/src/mode/modeFeelGates';
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

  it('MODE_PICKER_GROUPS (modeFeelGates) = FEEL_GATES: 8 ворот, unknown присутствует', () => {
    expect(MODE_PICKER_GROUPS).toBe(FEEL_GATES);
    expect(FEEL_GATES.length).toBe(8);
    expect(FEEL_GATES.some((g) => g.id === 'unknown')).toBe(true);
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

  it('дом не изменился — findTestGroupByModeId/modeChain считают по MODE_TEST_GROUPS', () => {
    expect(findTestGroupByModeId('angry_protector')?.id).toBe('avoid');
    expect(findTestGroupByModeId('bully_attack')?.id).toBe('grandiose');
    expect(findTestGroupByModeId('flagellating_oc')?.id).toBe('control');
    expect(findTestGroupByModeId('pollyanna')?.id).toBe('grandiose');
    expect(findTestGroupByModeId('attention_seeker')?.id).toBe('grandiose');
    expect(findTestGroupByModeId('undisciplined_child')?.id).toBe('anger');
  });
});
