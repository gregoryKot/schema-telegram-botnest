// R3 (аудит 2026-11): правила, по которым две записи с одним ключом
// складываются в одну при слиянии аккаунтов (merge-combine-rules.ts).
import {
  fillEmptyFields,
  joinDayNotes,
  joinGratitudeItems,
  joinTags,
  newerFirst,
} from './merge-combine-rules';

describe('joinDayNotes — заметка дня', () => {
  it('оба текста непустые: цель, пустая строка, источник', () => {
    expect(joinDayNotes('Устала', 'Поспала днём')).toBe(
      'Устала\n\nПоспала днём',
    );
  });

  it('пустой текст одной стороны — берётся другая, без лишних строк', () => {
    expect(joinDayNotes('', 'Поспала днём')).toBe('Поспала днём');
    expect(joinDayNotes('Устала', '   ')).toBe('Устала');
  });

  it('одинаковый текст (с точностью до краёвых пробелов) не дублируется', () => {
    expect(joinDayNotes('Устала', ' Устала \n')).toBe('Устала');
  });
});

describe('joinTags — метки заметки', () => {
  it('объединение без повторов, сначала метки цели', () => {
    expect(joinTags('work,sleep', 'sleep,family')).toBe('work,sleep,family');
  });

  it('пустые с обеих сторон — пусто, а не «,»', () => {
    expect(joinTags('', '')).toBe('');
    expect(joinTags('', 'sleep')).toBe('sleep');
  });
});

describe('joinGratitudeItems — благодарности за день', () => {
  it('пункты обоих без повторов', () => {
    // Повтор узнаётся по тексту без краёвых пробелов.
    const items = joinGratitudeItems(['чай', 'солнце'], ['солнце ', 'звонок']);
    expect(items.map((s) => s.trim())).toEqual(['чай', 'солнце', 'звонок']);
  });

  it('без общих пунктов — сначала пункты цели, следом источника', () => {
    expect(joinGratitudeItems(['чай'], ['звонок'])).toEqual(['чай', 'звонок']);
  });

  it('пустой день цели — пункты источника целиком', () => {
    expect(joinGratitudeItems([], ['звонок'])).toEqual(['звонок']);
  });
});

describe('fillEmptyFields — карточка схемы/режима', () => {
  const FIELDS = ['triggers', 'feelings', 'thoughts'];

  it('источник заполняет только пустые поля цели', () => {
    expect(
      fillEmptyFields(
        { triggers: 'критика', feelings: '', thoughts: '  ' },
        { triggers: 'опоздания', feelings: 'стыд', thoughts: 'я хуже' },
        FIELDS,
      ),
    ).toEqual({ feelings: 'стыд', thoughts: 'я хуже' });
  });

  it('пустое поле источника ничего не стирает', () => {
    expect(
      fillEmptyFields({ triggers: 'критика' }, { triggers: '' }, FIELDS),
    ).toEqual({});
  });
});

describe('newerFirst — более свежая запись', () => {
  const at = (r: { at: Date }) => r.at;
  const old = { at: new Date('2026-01-01T00:00:00Z'), who: 'old' };
  const fresh = { at: new Date('2026-02-01T00:00:00Z'), who: 'fresh' };

  it('свежая идёт первой, с какой бы стороны ни была', () => {
    expect(newerFirst(old, fresh, at)).toEqual([fresh, old]);
    expect(newerFirst(fresh, old, at)).toEqual([fresh, old]);
  });

  it('при равенстве первой идёт цель', () => {
    const same = { ...fresh, who: 'src' };
    expect(newerFirst(fresh, same, at)[0].who).toBe('fresh');
  });
});
