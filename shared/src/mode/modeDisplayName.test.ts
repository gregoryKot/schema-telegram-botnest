/**
 * Имя режима: своё имя человека всегда важнее клинического.
 *
 * Проверяем обе стороны правила про двойной ярлык: показываем ровно одно имя,
 * но клиническое остаётся доступным отдельным вызовом — иначе терапевт и
 * клиент говорят о разных вещах, а человек через полгода не вспомнит, кого
 * назвал «Стеной».
 */
import { describe, it, expect } from 'vitest';
import {
  modeDisplayName,
  hasOwnName,
  modeClinicalName,
} from './modeDisplayName';
import { getModeLeafLabel } from './modeFeelGates';

const KNOWN = 'detached_protector';

describe('modeDisplayName', () => {
  it('своё имя вытесняет клиническое', () => {
    expect(modeDisplayName(KNOWN, 'Стена')).toBe('Стена');
  });

  it('без своего имени показывает клиническое', () => {
    expect(modeDisplayName(KNOWN)).toBe(getModeLeafLabel(KNOWN));
  });

  it('пустой и пробельный алиас именем не считается', () => {
    expect(modeDisplayName(KNOWN, '')).toBe(getModeLeafLabel(KNOWN));
    expect(modeDisplayName(KNOWN, '   ')).toBe(getModeLeafLabel(KNOWN));
    expect(modeDisplayName(KNOWN, null)).toBe(getModeLeafLabel(KNOWN));
  });

  it('алиас обрезается по краям', () => {
    expect(modeDisplayName(KNOWN, '  Стена  ')).toBe('Стена');
  });

  it('режим вне реестра показывается своим id, а не пустотой', () => {
    expect(modeDisplayName('mode_which_does_not_exist')).toBe(
      'mode_which_does_not_exist',
    );
  });
});

describe('hasOwnName', () => {
  it('true только когда своё имя есть и отличается от клинического', () => {
    expect(hasOwnName(KNOWN, 'Стена')).toBe(true);
    expect(hasOwnName(KNOWN)).toBe(false);
    expect(hasOwnName(KNOWN, '  ')).toBe(false);
    expect(hasOwnName(KNOWN, getModeLeafLabel(KNOWN))).toBe(false);
  });
});

describe('modeClinicalName', () => {
  it('всегда возвращает клиническое имя, игнорируя своё', () => {
    expect(modeClinicalName(KNOWN)).toBe(getModeLeafLabel(KNOWN));
  });
});
