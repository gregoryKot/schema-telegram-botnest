// Правило №4: вход «не знаю, что чувствую» (MODE_UNKNOWN_GROUP) и реестр
// режимов (MODE_GROUPS) обязаны совпадать. Группа — вторая дверь к режимам,
// уже покрытым тестом modeTest (ALL_TEST_MODE_IDS), а не новый реестр —
// этот тест фиксирует и то, и другое, чтобы рассинхрон падал сразу.
//
// Ворота пикера (MODE_PICKER_GROUPS/FEEL_GATES, 8 ворот «по базовому
// чувству») и getModeLeafLabel переехали в modeFeelGates.ts, полное покрытие
// и регрессии кросс-входов — там (modeFeelGates.test.ts). Здесь остаётся
// сверка сырых данных (MODE_UNKNOWN_GROUP/SECOND_DOORS) плюс контрольная
// проверка, что модуль ворот действительно собран из них.
import { describe, it, expect } from 'vitest';
import { MODE_UNKNOWN_GROUP, SECOND_DOORS } from './modeBodyCues';
import { FEEL_GATES, MODE_PICKER_GROUPS } from './modeFeelGates';
import {
  MODE_TEST_GROUPS,
  ALL_TEST_MODE_IDS,
  findTestGroupByModeId,
} from './modeTest';

const TEST_GROUP_IDS = MODE_TEST_GROUPS.map((g) => g.id);

describe('MODE_UNKNOWN_GROUP', () => {
  it("id 'unknown', не совпадающий ни с одной семьёй теста", () => {
    expect(MODE_UNKNOWN_GROUP.id).toBe('unknown');
    expect(TEST_GROUP_IDS).not.toContain(MODE_UNKNOWN_GROUP.id);
  });

  it('emoji/title/hint непустые', () => {
    expect(MODE_UNKNOWN_GROUP.emoji.trim().length).toBeGreaterThan(0);
    expect(MODE_UNKNOWN_GROUP.title.trim().length).toBeGreaterThan(0);
    expect(MODE_UNKNOWN_GROUP.hint.trim().length).toBeGreaterThan(0);
  });

  it('листья непустые, modeId уникальны и покрыты тестом', () => {
    const { leaves } = MODE_UNKNOWN_GROUP;
    expect(leaves.length).toBeGreaterThan(0);
    const ids = leaves.map((l) => l.modeId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const modeId of ids) {
      expect(ALL_TEST_MODE_IDS).toContain(modeId);
    }
  });
});

describe('MODE_PICKER_GROUPS (modeFeelGates) — ворота собраны', () => {
  it('MODE_PICKER_GROUPS === FEEL_GATES', () => {
    expect(MODE_PICKER_GROUPS).toBe(FEEL_GATES);
  });

  it('8 ворот', () => {
    expect(FEEL_GATES.length).toBe(8);
  });

  it("ворота 'unknown' присутствуют", () => {
    expect(FEEL_GATES.some((g) => g.id === 'unknown')).toBe(true);
  });
});

describe('SECOND_DOORS', () => {
  const entries = Object.entries(SECOND_DOORS);

  it('ключи — существующие id семей MODE_TEST_GROUPS', () => {
    for (const [familyId] of entries) {
      expect(TEST_GROUP_IDS).toContain(familyId);
    }
  });

  it.each(entries)(
    'семья %s: листья валидны и не дублируют домашние',
    (familyId, leaves) => {
      const homeIds =
        MODE_TEST_GROUPS.find((g) => g.id === familyId)?.leaves.map(
          (l) => l.modeId,
        ) ?? [];
      for (const leaf of leaves) {
        expect(leaf.label.trim().length).toBeGreaterThan(0);
        expect(leaf.desc.trim().length).toBeGreaterThan(0);
        expect(leaf.emoji.trim().length).toBeGreaterThan(0);
        expect(ALL_TEST_MODE_IDS).toContain(leaf.modeId);
        expect(homeIds).not.toContain(leaf.modeId);
      }
    },
  );

  it('дом не изменился — findTestGroupByModeId/modeChain считают по MODE_TEST_GROUPS', () => {
    expect(findTestGroupByModeId('angry_protector')?.id).toBe('avoid');
    expect(findTestGroupByModeId('bully_attack')?.id).toBe('grandiose');
    expect(findTestGroupByModeId('flagellating_oc')?.id).toBe('control');
    expect(findTestGroupByModeId('pollyanna')?.id).toBe('grandiose');
    expect(findTestGroupByModeId('attention_seeker')?.id).toBe('grandiose');
    expect(findTestGroupByModeId('undisciplined_child')?.id).toBe('anger');
  });
});
