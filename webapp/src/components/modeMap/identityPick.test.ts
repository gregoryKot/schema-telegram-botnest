import { describe, it, expect } from 'vitest';
import { pickNeed, pickSchema } from './identityPick';
import { getSchemaById } from '../../schemaTherapyData';
import { needColor } from '../../../../shared/src/needs/needColors';
import { NEED_ORDER, getNeedData } from '../../needData';

describe('pickNeed — какая из пяти потребностей', () => {
  it('названия потребностей одинаковы в «ты» и «вы» — на этом держится выбор без формы обращения', () => {
    const ty = getNeedData('ty');
    const vy = getNeedData('vy');
    for (const id of NEED_ORDER) expect({ id, name: vy[id].name }).toEqual({ id, name: ty[id].name });
  });

  it('заготовка палитры «Потребность» получает название и цвет потребности', () => {
    expect(pickNeed({ label: 'Потребность' }, 'play')).toEqual({ needId: 'play', label: 'Спонтанность', customColor: needColor('play') });
  });

  it('смена выбора меняет прежнее название и прежний цвет', () => {
    const d = { label: 'Спонтанность', needId: 'play', customColor: needColor('play') };
    expect(pickNeed(d, 'limits')).toEqual({ needId: 'limits', label: 'Границы', customColor: needColor('limits') });
  });

  it('свою подпись и свой цвет терапевта не трогает', () => {
    expect(pickNeed({ label: 'Быть услышанной', customColor: 'var(--c-plum)' }, 'expression')).toEqual({ needId: 'expression' });
  });
});

describe('pickSchema — какая это схема', () => {
  const abandonment = getSchemaById('abandonment')!;
  const mistrust = getSchemaById('mistrust')!;

  it('заготовка «Схема» без цвета получает название и цвет домена', () => {
    expect(pickSchema({ label: 'Схема' }, 'abandonment'))
      .toEqual({ schemaId: 'abandonment', label: abandonment.name, customColor: abandonment.domainColor });
  });

  it('смена схемы меняет её название, своё название остаётся', () => {
    const d = { label: abandonment.name, schemaId: 'abandonment', customColor: abandonment.domainColor };
    expect(pickSchema(d, 'mistrust')).toEqual({ schemaId: 'mistrust', label: mistrust.name, customColor: mistrust.domainColor });
    expect(pickSchema({ ...d, label: 'Меня бросят' }, 'mistrust')).toEqual({ schemaId: 'mistrust', customColor: mistrust.domainColor });
  });

  it('«— выбрать —» или неизвестный id снимают связь, текст не трогают', () => {
    expect(pickSchema({ label: 'X', schemaId: 'abandonment' }, '')).toEqual({ schemaId: undefined });
    expect(pickSchema({ label: 'X' }, 'no_such_schema')).toEqual({ schemaId: undefined });
  });
});
