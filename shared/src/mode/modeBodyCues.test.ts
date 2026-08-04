// Инварианты вторых входов выбора режима живут здесь, в shared (правило №3
// CLAUDE.md — общий код, тест при нём). Парные тесты во фронтендах
// (webapp/schema-miniapp — src/components/diary/modeBodyCues.test.ts)
// сверяют только пофронтендный реестр MODE_GROUPS (schemaTherapyData),
// которого в shared нет и быть не должно.
//
// Инцидент 2026-08-04: modeBodyCues.ts (137 строк) был покрыт тестами
// только из фронтендов — в собственном прогоне shared давал 0% и уронил
// coverage-храповик (scripts/check-frontend-coverage-ratchet.mjs, джоба
// shared в CI).
import { describe, it, expect } from 'vitest';
import {
  MODE_UNKNOWN_GROUP,
  SECOND_DOORS,
  MODE_PICKER_GROUPS,
  getModeLeafLabel,
} from './modeBodyCues';
import {
  MODE_TEST_GROUPS,
  ALL_TEST_MODE_IDS,
  findTestGroupByModeId,
} from './modeTest';

const TEST_GROUP_IDS = MODE_TEST_GROUPS.map((g) => g.id);
const findGroup = (id: string) => MODE_TEST_GROUPS.find((g) => g.id === id)!;
const pickerGroup = (id: string) => MODE_PICKER_GROUPS.find((g) => g.id === id);

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

describe('MODE_PICKER_GROUPS — композиция', () => {
  it('длина = семьи теста + вход «не знаю» последним', () => {
    expect(MODE_PICKER_GROUPS.length).toBe(MODE_TEST_GROUPS.length + 1);
    expect(MODE_PICKER_GROUPS.at(-1)).toBe(MODE_UNKNOWN_GROUP);
  });

  it.each(TEST_GROUP_IDS)('семья %s собрана по правилу SECOND_DOORS', (id) => {
    const source = findGroup(id);
    const doors = SECOND_DOORS[id];
    if (doors) {
      expect(pickerGroup(id)?.leaves).toEqual([...source.leaves, ...doors]);
    } else {
      expect(pickerGroup(id)).toBe(source);
    }
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
      const homeIds = findGroup(familyId).leaves.map((l) => l.modeId);
      for (const leaf of leaves) {
        expect(leaf.label.trim().length).toBeGreaterThan(0);
        expect(leaf.desc.trim().length).toBeGreaterThan(0);
        expect(leaf.emoji.trim().length).toBeGreaterThan(0);
        expect(ALL_TEST_MODE_IDS).toContain(leaf.modeId);
        expect(homeIds).not.toContain(leaf.modeId);
      }
    },
  );

  it.each(entries)(
    'расширенная группа %s: emoji и label уникальны',
    (familyId) => {
      const leaves = pickerGroup(familyId)?.leaves ?? [];
      expect(new Set(leaves.map((l) => l.emoji)).size).toBe(leaves.length);
      expect(new Set(leaves.map((l) => l.label)).size).toBe(leaves.length);
    },
  );
});

describe('дом режима не сдвинут (modeChain опирается на findTestGroupByModeId)', () => {
  const HOME_FAMILY: Record<string, string> = {
    angry_protector: 'avoid',
    bully_attack: 'grandiose',
    flagellating_oc: 'control',
    pollyanna: 'grandiose',
    attention_seeker: 'grandiose',
    undisciplined_child: 'anger',
  };

  it.each(Object.entries(HOME_FAMILY))('%s → %s', (modeId, familyId) => {
    expect(findTestGroupByModeId(modeId)?.id).toBe(familyId);
  });
});

describe('вторые входы достижимы из своих дверей пикера (регрессия 2026-08-03)', () => {
  const DOOR_TO_MODES: Record<string, string[]> = {
    anger: ['angry_protector', 'bully_attack'],
    critic: ['flagellating_oc'],
    ok: ['pollyanna'],
    hurt: ['attention_seeker'],
    avoid: ['undisciplined_child'],
  };

  it.each(Object.entries(DOOR_TO_MODES))(
    'дверь %s открывает %j',
    (doorId, modeIds) => {
      const ids = pickerGroup(doorId)?.leaves.map((l) => l.modeId) ?? [];
      for (const modeId of modeIds) {
        expect(ids).toContain(modeId);
      }
    },
  );
});

describe('getModeLeafLabel', () => {
  it.each(ALL_TEST_MODE_IDS)('%s — непустая человеческая фраза', (modeId) => {
    const label = getModeLeafLabel(modeId);
    expect(label).toBeTruthy();
    expect(label?.trim().length).toBeGreaterThan(0);
  });

  it('неизвестный id — undefined', () => {
    expect(getModeLeafLabel('not_a_real_mode')).toBeUndefined();
  });
});
