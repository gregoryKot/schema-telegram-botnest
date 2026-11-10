// Вид режима и потребности «Мне плохо»: знак группы, свой знак «Сердитого Ребёнка» (решение 6),
// режим из общего словаря и неизвестная потребность.
import { describe, it, expect } from 'vitest';
import { flashcardModeLook, flashcardNeedLook, flashcardSummary, flashcardTitle } from './flashcardLook';
import { MODE_GROUP_HUE } from '../../../../shared/src/theme/entityHue';
import { buildModes, NEEDS } from '../../../../shared/src/flashcard/modes';

describe('flashcardModeLook', () => {
  it('режимы карточки — бумага и знак своей группы', () => {
    expect(flashcardModeLook('vulnerable_child')).toEqual({ hue: MODE_GROUP_HUE.child, sign: 'child_care' });
    expect(flashcardModeLook('detached')).toEqual({ hue: MODE_GROUP_HUE.coping_avoidance, sign: 'shelter' });
    expect(flashcardModeLook('critic')).toEqual({ hue: MODE_GROUP_HUE.critic, sign: 'looming' });
  });

  it('«Сердитый Ребёнок» — свой знак Flare на бумаге детских режимов', () => {
    expect(flashcardModeLook('angry_child')).toEqual({ hue: MODE_GROUP_HUE.child, sign: 'flare' });
  });

  it('режим не из карточки — по переданной группе; без группы — общий знак режимов', () => {
    expect(flashcardModeLook('punitive_critic', 'critic').sign).toBe('looming');
    expect(flashcardModeLook('no_such_mode').sign).toBe('cluster');
  });
});

describe('flashcardSummary и flashcardTitle', () => {
  const modes = buildModes((ty) => ty);
  it('свой режим и потребность — подписи и знаки', () => {
    const s = flashcardSummary({ mode: 'vulnerable_child', needId: 'attachment' }, modes, NEEDS);
    expect(s.mode).toEqual({ label: 'Уязвимый Ребёнок', sign: 'child_care' });
    expect(s.need?.sign).toBe('need_attachment');
    expect(flashcardTitle(s)).toBe(`Уязвимый Ребёнок · ${s.need?.label}`);
  });

  it('режим из общего словаря — его имя и знак группы, а не сырой id', () => {
    const s = flashcardSummary({ mode: 'punitive_critic', needId: 'autonomy' }, modes, NEEDS);
    expect(s.mode).toEqual({ label: 'Карающий Критик', sign: 'looming' });
    expect(flashcardTitle(s)).not.toContain('punitive_critic');
  });

  it('неизвестные режим и потребность — без частей, заголовок без пустых разделителей', () => {
    const s = flashcardSummary({ mode: 'gone', needId: 'gone' }, modes, NEEDS);
    expect(s).toEqual({ mode: null, need: null });
    expect(flashcardTitle(s)).toBe('');
    const onlyNeed = flashcardSummary({ mode: 'gone', needId: 'limits' }, modes, NEEDS);
    expect(flashcardTitle(onlyNeed)).toBe(onlyNeed.need?.label);
  });
});

describe('flashcardNeedLook', () => {
  it('потребность — её бумага и знак, неизвестная — без вида', () => {
    expect(flashcardNeedLook('attachment')).toEqual({ hue: 28, sign: 'need_attachment' });
    expect(flashcardNeedLook('nope')).toBeNull();
  });
});
