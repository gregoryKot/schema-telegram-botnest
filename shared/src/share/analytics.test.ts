// Тест общего билдера meta для mode_entry_saved (правило №8/№3: общий код
// обоих фронтов живёт в shared, а не копипастой).
import { describe, it, expect } from 'vitest';
import { modeEntrySavedMeta } from './analytics';

describe('modeEntrySavedMeta', () => {
  it('все поля пустые — {filledFields:0, filledHealthy:false}', () => {
    expect(modeEntrySavedMeta(['', '  ', '', '', '', '', ''], '')).toEqual({
      filledFields: 0,
      filledHealthy: false,
    });
  });

  it('часть полей заполнена + healthyResponse — верный счётчик и true', () => {
    expect(
      modeEntrySavedMeta(
        ['ситуация', '', 'чувства', '  ', 'действия', '', ''],
        'ответ здорового взрослого',
      ),
    ).toEqual({ filledFields: 3, filledHealthy: true });
  });

  it('healthyResponse из одних пробелов не считается заполненным', () => {
    expect(
      modeEntrySavedMeta(['a', 'b', 'c', 'd', 'e', 'f', 'g'], '   '),
    ).toEqual({ filledFields: 7, filledHealthy: false });
  });
});
