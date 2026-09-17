// Покрываем: все восемь ворот заполнены непустыми label/id без дублей
// внутри ворот; у каждых ворот последний чип — «Своё…»; ни на одних воротах
// чипы не повторяют подписи листьев выбора части; buildBodyPayoff — смоук.
import { describe, it, expect } from 'vitest';
import { FEEL_GATES } from '../mode/modeFeelGates';
import type { CaseGateId } from './caseTypes';
import { CASE_BODY_CHIPS, buildBodyPayoff } from './caseBodyChips';
import type { Tr } from './caseTypes';

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

  it('подписи чипов не повторяются между воротами', () => {
    const allContentLabels = GATE_IDS.flatMap((g) =>
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

describe('чипы не повторяют выбор части', () => {
  // Реальный баг: у ворот «пусто или не пойму» телесные чипы собирались из
  // тех же листьев MODE_UNKNOWN_GROUP, которые человек только что видел на
  // шаге выбора части. Один и тот же список подряд читается как сбой
  // приложения, а не как второй вопрос. Проверяем все восемь ворот сразу —
  // класс, а не единственный случай.
  it.each(FEEL_GATES.map((g) => [g.id, g] as const))(
    'ворота «%s»: ни один чип не дублирует подпись листа',
    (_id, gate) => {
      const leafLabels = new Set(
        gate.leaves.map((l) => l.label.trim().toLowerCase()),
      );
      const clashing = CASE_BODY_CHIPS[gate.id as CaseGateId]
        .map((c) => c.label.trim().toLowerCase())
        .filter((label) => leafLabels.has(label));
      expect(clashing).toEqual([]);
    },
  );
});
