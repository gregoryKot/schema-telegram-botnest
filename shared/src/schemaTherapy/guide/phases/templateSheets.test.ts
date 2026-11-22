// Лист шаблона пути собирается из данных шаблона: сроки, условность, этапы ленты, переходы без повторов.
import { describe, it, expect } from 'vitest';
import type { PathTemplate } from '../../../therapy/path/templates';
import { buildPhaseGuides } from './all';
import { templateSheet, weeksLabel } from './templateSheets';
import type { PhaseGuide } from './types';

const path: PhaseGuide[] = [
  { id: 'safety', name: 'Безопасность', goal: '', essence: '', sources: '' },
];
const template: PathTemplate = {
  id: 'demo',
  name: 'Проба',
  summary: 'кратко',
  essence: 'суть',
  timing: 'Срок.',
  sources: '[Кембридж, гл. 1]',
  phases: [
    {
      id: 'a',
      name: 'Первая',
      goal: 'цель',
      therapist: 'Делает.',
      stance: 'Рядом.',
      weeks: 2,
      weeksFrom: 'source',
      sessionsHint: 'сессии 1–2',
      transition: ['раз', 'два'],
      mistakes: ['ошибка'],
      recommended: ['technique:chairwork/summary', 'mode:healthy_adult/goal'],
      guidePhaseIds: ['safety', 'нет'],
    },
    {
      id: 'b',
      name: 'Вторая',
      goal: 'цель',
      therapist: 'Делает.',
      stance: 'Рядом.',
      weeks: 21,
      weeksFrom: 'estimate',
      transition: ['три'],
      mistakes: ['промах'],
      recommended: ['technique:chairwork/summary', 'note:ending_phase/points'],
      guidePhaseIds: [],
    },
  ],
};

describe('templateSheet', () => {
  const sheet = templateSheet(template, path);

  it('лист встаёт в группу шаблонов со своим id и общим сроком', () => {
    expect([sheet.id, sheet.group]).toEqual(['template_demo', 'templates']);
    expect(sheet.timing).toBe('Срок. Всего в шаблоне 23 недели.');
  });

  it('строка фазы: номер, срок, подсказка в сессиях, условность и этапы ленты', () => {
    expect(sheet.stages?.[0]).toBe(
      '1. Первая — 2 недели, сессии 1–2. Цель: цель. Терапевт: Делает. Позиция: Рядом. В ленте фаз: «Безопасность».',
    );
    expect(sheet.stages?.[1]).toContain('2. Вторая — 21 неделя условно.');
    expect(sheet.stages?.[1]).not.toContain('В ленте фаз');
  });

  it('критерии и ошибки — по фазам; переходы — по видам и без повторов', () => {
    expect(sheet.transition).toEqual(['Первая: раз; два.', 'Вторая: три.']);
    expect(sheet.mistakes).toEqual(['Первая: ошибка.', 'Вторая: промах.']);
    expect(sheet.techniques).toEqual(['chairwork']);
    expect(sheet.modeIds).toEqual(['healthy_adult']);
    expect(sheet.noteIds).toEqual(['ending_phase']);
  });

  it('недели склоняются', () => {
    expect([1, 3, 5, 12].map(weeksLabel)).toEqual([
      '1 неделя',
      '3 недели',
      '5 недель',
      '12 недель',
    ]);
  });
});

it('листы шаблонов замыкают вкладку', () => {
  const groups = buildPhaseGuides((t) => t).map((p) => p.group ?? 'path');
  const tail = groups.slice(groups.indexOf('templates'));
  expect(tail.length).toBeGreaterThan(2);
  expect(new Set(tail)).toEqual(new Set(['templates']));
});
