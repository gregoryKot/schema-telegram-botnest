// Досбор по Кембриджу (гл. 1–6): сохранили в файле-продолжении — нашли в собранном справочнике.
import { describe, it, expect } from 'vitest';
import {
  buildPhaseGuides,
  buildTechniqueGuides,
  modeGuide,
  practiceNotes,
} from './index';
import type { Tr } from './types';

const ty: Tr = (t) => t;
const vy: Tr = (_t, v) => v;

describe.each([
  ['ты', ty],
  ['вы', vy],
])('досбор Кембриджа, форма «%s»', (_name, tr) => {
  it('техники и режим: пункты «Подробнее» и реплики дошли до листа', () => {
    const tech = (id: string) =>
      buildTechniqueGuides(tr).find((t) => t.id === id)!;
    expect(tech('imagery_rescripting').more?.join(' ')).toContain('пульса');
    expect(tech('chairwork').more?.join(' ')).toContain('поучать');
    expect(tech('limit_setting').more?.join(' ')).toContain('Вопрос-фильтр');
    expect(tech('mode_map').voice?.join(' ')).toContain('бабушки');
    expect(modeGuide(tr, 'angry_child')!.more?.join(' ')).toContain('комиков');
  });

  it('«Для терапевта»: расспрос, первая сессия и «болтовня»', () => {
    const note = (id: string) => practiceNotes(tr).find((n) => n.id === id)!;
    expect(note('history_interview').more?.join(' ')).toContain('под радаром');
    expect(note('first_session').more?.join(' ')).toContain('азартные игры');
    expect(note('chatting').more?.join(' ')).toContain('по книгам');
  });

  it('путь терапии: критерии боксов 5.5 и 5.7 и три шага Здорового Взрослого', () => {
    const phase = (id: string) =>
      buildPhaseGuides(tr).find((p) => p.id === id)!;
    expect(phase('safety').transition?.join(' ')).toContain('языком схем');
    expect(phase('healing').transition?.join(' ')).toContain('задним числом');
    expect(phase('managing').tasks?.join(' ')).toContain('переатрибуцией');
  });
});
