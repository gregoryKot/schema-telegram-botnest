// Вид листов подсказок: бумага группы или домена и знак — те же таблицы, что у клиента.
import { describe, it, expect } from 'vitest';
import { DOMAIN_HUE, MODE_GROUP_HUE } from '../../../../../shared/src/theme/entityHue';
import { ENTITY_LOOK, PAPER_HUE } from '../../../../../shared/src/theme/entityLook';
import { modeGuideLook, practiceNoteLook, schemaGuideLook, techniqueGuideLook } from './guideLook';

describe('guideLook', () => {
  it('режим — бумага группы и её знак; у «Сердитого Ребёнка» знак свой, бумага группы', () => {
    expect(modeGuideLook('punitive_critic')).toEqual({ hue: MODE_GROUP_HUE.critic, sign: 'looming' });
    expect(modeGuideLook('vulnerable_child')).toEqual({ hue: MODE_GROUP_HUE.child, sign: 'child_care' });
    expect(modeGuideLook('angry_child')).toEqual({ hue: MODE_GROUP_HUE.child, sign: 'flare' });
  });

  it('режим не из реестра — общий вид режимов, а не чужая группа', () => {
    expect(modeGuideLook('свой_режим')).toEqual({ hue: ENTITY_LOOK.modes.hue, sign: 'cluster' });
  });

  it('схема — бумага и знак домена; неизвестная — без вида', () => {
    expect(schemaGuideLook('abandonment')).toEqual({ hue: DOMAIN_HUE.rejection, sign: 'domain_rejection' });
    expect(schemaGuideLook('failure')).toEqual({ hue: DOMAIN_HUE.autonomy, sign: 'domain_autonomy' });
    expect(schemaGuideLook('нет_такой')).toBeNull();
  });

  it('техника — персик и свой знак; «Для терапевта» — небо кабинета, раздел без знака — без картинки', () => {
    expect(techniqueGuideLook('chairwork')).toEqual({ hue: PAPER_HUE.peach, sign: 'talk' });
    expect(practiceNoteLook('impasses')).toEqual({ hue: ENTITY_LOOK.therapist.hue, sign: 'ribbon' });
    expect(practiceNoteLook('свой_раздел')).toEqual({ hue: ENTITY_LOOK.therapist.hue, sign: undefined });
  });
});
