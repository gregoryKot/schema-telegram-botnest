// Ворота выбора режима «по базовым чувствам» (monitoring-modes-ux-s8rzyd):
// покрытие 35/35 modeId, отсутствие дублей ВНУТРИ ворот (дубли МЕЖДУ
// воротами — намеренные кросс-входы), достижимость известных кросс-входов и
// неизменность домашней таксономии (findTestGroupByModeId/modeChain).
import { describe, it, expect } from 'vitest';
import {
  FEEL_GATES,
  MODE_PICKER_GROUPS,
  getModeLeafLabel,
  findPickerGroupIdByModeId,
} from './modeFeelGates';
import {
  MODE_TEST_GROUPS,
  ALL_TEST_MODE_IDS,
  findTestGroupByModeId,
} from './modeTest';
import { MODE_UNKNOWN_GROUP, SECOND_DOORS } from './modeBodyCues';

const gate = (id: string) => FEEL_GATES.find((g) => g.id === id);
const leafIds = (id: string) => gate(id)?.leaves.map((l) => l.modeId) ?? [];

describe('FEEL_GATES — покрытие 35/35', () => {
  it('MODE_PICKER_GROUPS — это FEEL_GATES (та же ссылка)', () => {
    expect(MODE_PICKER_GROUPS).toBe(FEEL_GATES);
  });

  it('ровно 8 ворот', () => {
    expect(FEEL_GATES.length).toBe(8);
    expect(FEEL_GATES.map((g) => g.id)).toEqual([
      'fear',
      'sad',
      'anger',
      'shame',
      'drained',
      'unknown',
      'above',
      'ok',
    ]);
  });

  it("ворота 'unknown' присутствуют", () => {
    expect(gate('unknown')).toBeTruthy();
  });

  it('каждый modeId из ALL_TEST_MODE_IDS встречается хотя бы в одних воротах (35/35)', () => {
    const union = new Set(
      FEEL_GATES.flatMap((g) => g.leaves.map((l) => l.modeId)),
    );
    expect(union.size).toBe(ALL_TEST_MODE_IDS.length);
    for (const modeId of ALL_TEST_MODE_IDS) {
      expect(union.has(modeId)).toBe(true);
    }
  });

  it.each(FEEL_GATES.map((g) => g.id))(
    'ворота %s: непустые title/hint/question',
    (id) => {
      const g = gate(id)!;
      expect(g.title.trim().length).toBeGreaterThan(0);
      expect(g.hint.trim().length).toBeGreaterThan(0);
      expect(g.question.trim().length).toBeGreaterThan(0);
    },
  );

  it.each(FEEL_GATES.map((g) => g.id))(
    'ворота %s: modeId/emoji/label листьев уникальны внутри ворот',
    (id) => {
      const leaves = gate(id)!.leaves;
      expect(new Set(leaves.map((l) => l.modeId)).size).toBe(leaves.length);
      expect(new Set(leaves.map((l) => l.emoji)).size).toBe(leaves.length);
      expect(new Set(leaves.map((l) => l.label)).size).toBe(leaves.length);
    },
  );

  it.each(FEEL_GATES.map((g) => g.id))(
    'ворота %s: каждый leaf.modeId существует в ALL_TEST_MODE_IDS',
    (id) => {
      for (const modeId of leafIds(id)) {
        expect(ALL_TEST_MODE_IDS).toContain(modeId);
      }
    },
  );

  it("ворота 'unknown' содержат ровно листья MODE_UNKNOWN_GROUP", () => {
    expect(gate('unknown')?.leaves).toEqual(MODE_UNKNOWN_GROUP.leaves);
  });
});

describe('регрессии достижимости кросс-входов (раскладка monitoring-modes-ux-s8rzyd)', () => {
  it("'anger' открывает angry_protector и bully_attack", () => {
    expect(leafIds('anger')).toContain('angry_protector');
    expect(leafIds('anger')).toContain('bully_attack');
  });

  it("'ok' открывает pollyanna", () => {
    expect(leafIds('ok')).toContain('pollyanna');
  });

  it("'sad' открывает attention_seeker", () => {
    expect(leafIds('sad')).toContain('attention_seeker');
  });

  it("'shame' открывает flagellating_oc и compliant_surrenderer", () => {
    expect(leafIds('shame')).toContain('flagellating_oc');
    expect(leafIds('shame')).toContain('compliant_surrenderer');
  });

  it("'drained' открывает undisciplined_child", () => {
    expect(leafIds('drained')).toContain('undisciplined_child');
  });
});

describe('кросс-входы используют формулировку второго входа, не домашнюю', () => {
  const leafOf = (gateId: string, modeId: string) =>
    gate(gateId)?.leaves.find((l) => l.modeId === modeId);

  it("'sad'.attention_seeker = SECOND_DOORS.hurt (не домашний grandiose)", () => {
    const door = SECOND_DOORS.hurt.find(
      (l) => l.modeId === 'attention_seeker',
    )!;
    const leaf = leafOf('sad', 'attention_seeker')!;
    expect(leaf.label).toBe(door.label);
    expect(leaf.desc).toBe(door.desc);
  });

  it("'above'.attention_seeker = домашний label (отличается от 'sad')", () => {
    expect(leafOf('above', 'attention_seeker')?.label).toBe(
      'Нужно, чтобы замечали и одобряли',
    );
    expect(leafOf('above', 'attention_seeker')?.label).not.toBe(
      leafOf('sad', 'attention_seeker')?.label,
    );
  });

  it("'anger'.angry_protector/bully_attack = SECOND_DOORS.anger", () => {
    for (const modeId of ['angry_protector', 'bully_attack']) {
      const door = SECOND_DOORS.anger.find((l) => l.modeId === modeId)!;
      const leaf = leafOf('anger', modeId)!;
      expect(leaf.label).toBe(door.label);
      expect(leaf.desc).toBe(door.desc);
    }
  });

  it("'above'.bully_attack = домашний label (grandiose, отличается от 'anger')", () => {
    expect(leafOf('above', 'bully_attack')?.label).toBe(
      'Давлю и запугиваю, чтобы добиться своего',
    );
    expect(leafOf('above', 'bully_attack')?.label).not.toBe(
      leafOf('anger', 'bully_attack')?.label,
    );
  });

  it("'shame'.flagellating_oc = SECOND_DOORS.critic", () => {
    const door = SECOND_DOORS.critic.find(
      (l) => l.modeId === 'flagellating_oc',
    )!;
    const leaf = leafOf('shame', 'flagellating_oc')!;
    expect(leaf.label).toBe(door.label);
    expect(leaf.desc).toBe(door.desc);
  });

  it("'shame'.compliant_surrenderer — новый label, домашний desc", () => {
    const homeLeaf = MODE_TEST_GROUPS.find(
      (g) => g.id === 'surrender',
    )!.leaves.find((l) => l.modeId === 'compliant_surrenderer')!;
    const leaf = leafOf('shame', 'compliant_surrenderer')!;
    expect(leaf.label).toBe('Неловко отказать — соглашаюсь');
    expect(leaf.label).not.toBe(homeLeaf.label);
    expect(leaf.desc).toBe(homeLeaf.desc);
  });

  it("'drained'.undisciplined_child = SECOND_DOORS.avoid", () => {
    const door = SECOND_DOORS.avoid.find(
      (l) => l.modeId === 'undisciplined_child',
    )!;
    const leaf = leafOf('drained', 'undisciplined_child')!;
    expect(leaf.label).toBe(door.label);
    expect(leaf.desc).toBe(door.desc);
  });

  it("'drained'.avoidant_protector — домашний лист (не через SECOND_DOORS)", () => {
    const homeLeaf = MODE_TEST_GROUPS.find(
      (g) => g.id === 'avoid',
    )!.leaves.find((l) => l.modeId === 'avoidant_protector')!;
    expect(leafOf('drained', 'avoidant_protector')).toEqual(homeLeaf);
  });

  it("'ok'.pollyanna = SECOND_DOORS.ok", () => {
    const door = SECOND_DOORS.ok.find((l) => l.modeId === 'pollyanna')!;
    const leaf = leafOf('ok', 'pollyanna')!;
    expect(leaf.label).toBe(door.label);
    expect(leaf.desc).toBe(door.desc);
  });
});

describe('дом режима не сдвинут (modeChain опирается на findTestGroupByModeId)', () => {
  const HOME_FAMILY: Record<string, string> = {
    angry_protector: 'avoid',
    bully_attack: 'grandiose',
    pollyanna: 'grandiose',
    attention_seeker: 'grandiose',
    flagellating_oc: 'control',
    undisciplined_child: 'anger',
  };

  it.each(Object.entries(HOME_FAMILY))('%s → %s', (modeId, familyId) => {
    expect(findTestGroupByModeId(modeId)?.id).toBe(familyId);
  });
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

// Обратный поиск ворот по режиму: на нём держится «Назад» с шага записи в
// дневнике режимов (ModeEntrySheet) и восстановление шага у черновика.
describe('findPickerGroupIdByModeId', () => {
  it('возвращает ворота, в которых режим действительно показан', () => {
    expect(findPickerGroupIdByModeId('avoidant_protector')).toBe('fear');
    expect(findPickerGroupIdByModeId('detached_protector')).toBe('unknown');
  });

  it('для неизвестного режима отдаёт null, а не первые попавшиеся ворота', () => {
    expect(findPickerGroupIdByModeId('нет_такого_режима')).toBeNull();
    expect(findPickerGroupIdByModeId('')).toBeNull();
  });

  it('любой найденный id — реальные ворота', () => {
    for (const gate of FEEL_GATES) {
      for (const leaf of gate.leaves) {
        const id = findPickerGroupIdByModeId(leaf.modeId);
        expect(FEEL_GATES.some((g) => g.id === id)).toBe(true);
      }
    }
  });
});
