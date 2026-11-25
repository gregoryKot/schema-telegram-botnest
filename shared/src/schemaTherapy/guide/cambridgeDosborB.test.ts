// Досбор по Кембриджу (гл. 7–12): сохранили в файле-продолжении — нашли в собранном справочнике, по одному разу.
import { describe, it, expect } from 'vitest';
import {
  buildTechniqueGuides,
  modeGuide,
  practiceNotes,
  schemaGuide,
} from './index';
import type { Tr } from './types';

const ty: Tr = (t) => t;
const vy: Tr = (_t, v) => v;

const once = (items: string[] | undefined, part: string) =>
  (items ?? []).filter((s) => s.includes(part)).length;

describe.each([
  ['ты', ty],
  ['вы', vy],
])('досбор Кембриджа, гл. 7–12, форма «%s»', (_name, tr) => {
  const tech = (id: string) =>
    buildTechniqueGuides(tr).find((t) => t.id === id)!;

  it('техники: пункты досбора доходят до листа ровно один раз', () => {
    expect(once(tech('cognitive_work').more, 'запас здоровых образцов')).toBe(
      1,
    );
    expect(once(tech('cognitive_work').more, 'Сетка 2×2')).toBe(1);
    expect(once(tech('letters').more, 'пустому стулу')).toBe(1);
    expect(once(tech('mode_map').more, 'ворота в стене')).toBe(1);
    expect(once(tech('imagery_rescripting').more, 'отмотать плёнку')).toBe(1);
    expect(once(tech('chairwork').more, 'Срыв раскладывают на три стула')).toBe(
      1,
    );
    expect(once(tech('historical_role_play').more, 'выходит из роли')).toBe(1);
    expect(once(tech('mode_interview').more, 'через переводчика')).toBe(1);
    expect(once(tech('future_imagery').more, 'рескриптинг наоборот')).toBe(1);
    expect(once(tech('self_compassion').more, 'эгодистонным')).toBe(1);
    expect(once(tech('pattern_breaking').more, 'трёх источников')).toBe(1);
  });

  it('прежние реплики идут первыми, новые — следом', () => {
    const voice = tech('cognitive_work').voice ?? [];
    expect(voice[0]).toContain('чей это голос');
    expect(voice.join(' ')).toContain('хорошо учиться невозможно');
    expect(tech('mode_interview').voice?.[0]).toContain('Стена, спасибо');
  });

  it('режимы и схемы: пункты и связи досбора', () => {
    const dp = modeGuide(tr, 'detached_protector')!;
    expect(once(dp.more, 'большой палец вверх')).toBe(1);
    expect(once(dp.more, 'суррогатную идентичность')).toBe(1);
    expect(once(modeGuide(tr, 'angry_child')!.more, 'Огненный шар')).toBe(1);
    const av = modeGuide(tr, 'avoidant_protector')!;
    expect(once(av.more, 'расщеплённого самораскрытия')).toBe(1);
    expect(av.moreTechniques).toContain('chairwork');
    expect(modeGuide(tr, 'happy_child')!.more?.join(' ')).toContain(
      'регулятор',
    );
    expect(modeGuide(tr, 'healthy_adult')!.moreTechniques).toContain(
      'cognitive_work',
    );
    expect(schemaGuide(tr, 'emotional_deprivation')!.guide.modeIds).toContain(
      'compliant_surrenderer',
    );
    expect(
      once(schemaGuide(tr, 'entitlement')!.guide.more, 'господин — слуга'),
    ).toBe(1);
  });

  it('«Для терапевта»: финал и право на «неправильные» выборы', () => {
    const note = (id: string) => practiceNotes(tr).find((n) => n.id === id)!;
    expect(once(note('ending_phase').more, 'не подсказывает имя режима')).toBe(
      1,
    );
    expect(
      once(note('therapist_schemas').more, 'права на «неправильные»'),
    ).toBe(1);
  });
});
