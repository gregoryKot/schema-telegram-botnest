// Покрываем: все восемь ворот заполнены непустыми label/id без дублей
// внутри ворот; у каждых ворот последний чип — «Своё…»; ворота 'unknown'
// собраны из MODE_UNKNOWN_GROUP.leaves, а не переписаны вручную (правило
// №11 CLAUDE.md — третья копия формулировок запрещена); buildBodyPayoff —
// смоук.
import { describe, it, expect } from 'vitest';
import { CASE_BODY_CHIPS, buildBodyPayoff } from './caseBodyChips';
import { MODE_UNKNOWN_GROUP } from '../mode/modeBodyCues';
import type { CaseGateId, Tr } from './caseTypes';

const GATE_IDS: CaseGateId[] = [
  'fear',
  'sad',
  'anger',
  'shame',
  'drained',
  'unknown',
  'above',
  'ok',
];

const tyTr: Tr = (ty) => ty;

describe('CASE_BODY_CHIPS — восемь ворот', () => {
  it('заполнены ровно все восемь ворот', () => {
    expect(Object.keys(CASE_BODY_CHIPS).sort()).toEqual([...GATE_IDS].sort());
  });

  it.each(GATE_IDS)('ворота %s: непустые id/label, нет дублей id', (gateId) => {
    const chips = CASE_BODY_CHIPS[gateId];
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) {
      expect(chip.id.trim().length).toBeGreaterThan(0);
      expect(chip.label.trim().length).toBeGreaterThan(0);
    }
    expect(new Set(chips.map((c) => c.id)).size).toBe(chips.length);
  });

  it.each(GATE_IDS)('ворота %s: последний чип — «Своё…»', (gateId) => {
    const chips = CASE_BODY_CHIPS[gateId];
    expect(chips[chips.length - 1].label).toBe('Своё…');
  });

  it("ворота 'unknown' собраны из MODE_UNKNOWN_GROUP, а не переписаны руками", () => {
    const unknownContentChips = CASE_BODY_CHIPS.unknown.slice(0, -1);
    expect(unknownContentChips.map((c) => c.label)).toEqual(
      MODE_UNKNOWN_GROUP.leaves.map((l) => l.label),
    );
    expect(unknownContentChips.length).toBe(MODE_UNKNOWN_GROUP.leaves.length);
  });

  it('семь небазовых ворот не содержат имён эмоций дословно из соседних ворот (нет копипасты)', () => {
    const nonUnknown = GATE_IDS.filter((g) => g !== 'unknown');
    const allContentLabels = nonUnknown.flatMap((g) =>
      CASE_BODY_CHIPS[g].slice(0, -1).map((c) => c.label),
    );
    expect(new Set(allContentLabels).size).toBe(allContentLabels.length);
  });
});

describe('buildBodyPayoff', () => {
  it('непустая строка', () => {
    expect(buildBodyPayoff(tyTr).length).toBeGreaterThan(0);
  });
});
