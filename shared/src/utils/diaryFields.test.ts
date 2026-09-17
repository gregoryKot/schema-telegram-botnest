// Сбор необязательных заполненных полей дневниковой записи для payload —
// обязательное поле и пустые/пробельные значения должны выпадать, иначе
// на сервер уйдут пустые строки вместо отсутствия поля.
import { describe, it, expect } from 'vitest';
import { collectFilledFields } from './diaryFields';

describe('collectFilledFields', () => {
  const keys = ['trigger', 'thoughts', 'healthyView'] as const;

  it('обязательное поле исключается, даже если заполнено', () => {
    const result = collectFilledFields(
      { trigger: 'Ситуация', thoughts: 'Мысль', healthyView: '' },
      keys,
      'trigger',
    );
    expect(result).toEqual({ thoughts: 'Мысль' });
  });

  it('пустые и пробельные значения не попадают в результат', () => {
    const result = collectFilledFields(
      { trigger: 'x', thoughts: '', healthyView: '   ' },
      keys,
      'trigger',
    );
    expect(result).toEqual({});
  });

  it('все необязательные поля заполнены — все попадают, без изменения текста', () => {
    const result = collectFilledFields(
      { trigger: 'x', thoughts: 'A', healthyView: 'B' },
      keys,
      'trigger',
    );
    expect(result).toEqual({ thoughts: 'A', healthyView: 'B' });
  });
});
