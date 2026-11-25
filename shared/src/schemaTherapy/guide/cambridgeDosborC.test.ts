// Досбор по Кембриджу (гл. 13–15, 17–20, приложение): сохранили в файлах-продолжениях — нашли в собранном справочнике, по одному разу.
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
])('досбор Кембриджа, гл. 13–20, форма «%s»', (_name, tr) => {
  const note = (id: string) => practiceNotes(tr).find((n) => n.id === id)!;
  const tech = (id: string) =>
    buildTechniqueGuides(tr).find((t) => t.id === id)!;

  it('«Для терапевта»: группа, онлайн, терапевт', () => {
    expect(once(note('group_therapy').more, 'щитом')).toBe(1);
    expect(once(note('group_therapy').more, 'после мини-ссоры')).toBe(1);
    expect(once(note('group_techniques').more, 'эгосинтонен')).toBe(1);
    expect(once(note('group_techniques').more, 'старому другу')).toBe(1);
    expect(once(note('online_format').more, 'не плачу за потерянные')).toBe(1);
    expect(once(note('therapist_schemas').more, 'идеальный шторм')).toBe(1);
    expect(once(note('therapist_wellbeing').more, '«быть с»')).toBe(1);
    expect(once(note('romance_and_partner').more, 'Аффективный мост')).toBe(1);
    expect(once(note('method_errors').more, 'не хватает знаний')).toBe(1);
    expect(once(note('history_interview').more, 'питомец')).toBe(1);
  });

  it('прежние реплики идут первыми, новые следом', () => {
    expect(note('online_format').voice?.[0]).toContain('найдём расстояние');
    expect(note('online_format').voice).toHaveLength(2);
    expect(note('group_techniques').voice?.[0]).toContain('стул Защитника');
    expect(note('therapist_wellbeing').voice?.[0]).toContain('минуты на себя');
    expect(note('romance_and_partner').voice).toHaveLength(2);
    expect(tech('online_chairwork').voice?.[0]).toContain('отстранённой части');
    expect(tech('online_chairwork').voice).toHaveLength(3);
  });

  it('техники: пункты досбора доходят до листа ровно один раз', () => {
    expect(once(tech('mode_interview').more, 'При ОКР ход на стульях')).toBe(1);
    expect(once(tech('mode_interview').more, 'Узнавшего Защитника')).toBe(1);
    expect(once(tech('empathic_confrontation').more, 'слабительных')).toBe(1);
    expect(once(tech('empathic_confrontation').more, 'бокс 17.4')).toBe(2);
    expect(once(tech('imagery_rescripting').more, 'подметает пол')).toBe(1);
    expect(once(tech('imagery_rescripting').more, 'сорегуляция')).toBe(1);
    expect(once(tech('need_now_question').more, 'доступ к режимам')).toBe(1);
    expect(once(tech('mode_map').more, 'метаубеждения')).toBe(1);
    expect(once(tech('online_chairwork').more, 'куклами')).toBe(1);
  });

  it('режимы и схемы: пункты досбора и прежний порядок', () => {
    const sa = modeGuide(tr, 'self_aggrandiser')!;
    expect(once(sa.more, 'Ловушка лести')).toBe(1);
    expect(sa.voice?.[0]).toContain('Мне тоже нужно место');
    expect(once(modeGuide(tr, 'angry_protector')!.more, '«отстань»')).toBe(1);
    expect(once(modeGuide(tr, 'vulnerable_child')!.more, 'лояльность')).toBe(1);
    const pc = modeGuide(tr, 'punitive_critic')!;
    expect(once(pc.more, 'устаревшее наследие')).toBe(1);
    expect(pc.voice?.[0]).toContain('Это неправда');
    const dep = schemaGuide(tr, 'dependence')!.guide.more ?? [];
    expect(dep.findIndex((s) => s.startsWith('О детстве'))).toBeLessThan(
      dep.findIndex((s) => s.includes('взаимозависимости')),
    );
    expect(once(dep, 'взаимозависимости')).toBe(1);
    const ss = schemaGuide(tr, 'self_sacrifice')!.guide.more ?? [];
    expect(once(ss, 'отдельной идентичности')).toBe(1);
    expect(once(ss, 'родитель-нарцисс')).toBe(1);
  });
});
