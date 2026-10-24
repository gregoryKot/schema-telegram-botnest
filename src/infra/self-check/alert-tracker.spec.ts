import { SelfCheckAlertTracker } from './alert-tracker';
import { SelfCheckResultEntry } from './state';

const T0 = 1_700_000_000_000;
const H = 3_600_000;

function failed(id: string, detail = 'сломано'): SelfCheckResultEntry {
  return {
    id,
    title: `Проба ${id}`,
    critical: false,
    ok: false,
    detail,
    reportInHealth: true,
  };
}

describe('SelfCheckAlertTracker', () => {
  it('всё зелёное, аварии не было — тишина (null)', () => {
    const t = new SelfCheckAlertTracker();
    expect(t.noteResult([], T0)).toBeNull();
    expect(t.isOpen).toBe(false);
  });

  it('первая упавшая проба открывает аварию и даёт текст с её title (не id) и деталью', () => {
    const t = new SelfCheckAlertTracker();
    const entry: SelfCheckResultEntry = {
      id: 'caldav',
      title: 'Личный календарь (iCloud)',
      critical: false,
      ok: false,
      detail: 'обнаружение не нашло календарей',
      reportInHealth: true,
    };
    const text = t.noteResult([entry], T0);
    expect(text).toContain('Самопроверка нашла проблему');
    expect(text).toContain('Личный календарь (iCloud)');
    expect(text).toContain('обнаружение не нашло календарей');
    expect(t.isOpen).toBe(true);
  });

  it('несколько упавших проб — заголовок с числом, каждая своей строкой', () => {
    const t = new SelfCheckAlertTracker();
    const text = t.noteResult(
      [failed('db', 'не отвечает'), failed('telegram', 'таймаут')],
      T0,
    );
    expect(text).toContain('Самопроверка нашла проблемы (2)');
    expect(text).toContain('• Проба db: не отвечает');
    expect(text).toContain('• Проба telegram: таймаут');
  });

  it('повтор той же аварии раньше 6 часов — молчит', () => {
    const t = new SelfCheckAlertTracker();
    t.noteResult([failed('db')], T0);
    expect(t.noteResult([failed('db')], T0 + H)).toBeNull();
    expect(t.noteResult([failed('db')], T0 + 5 * H)).toBeNull();
  });

  it('авария длится дольше 6 часов — напоминание', () => {
    const t = new SelfCheckAlertTracker();
    t.noteResult([failed('db')], T0);
    const reminder = t.noteResult([failed('db')], T0 + 6 * H + 1);
    expect(reminder).toContain('Самопроверка нашла проблему');
  });

  it('восстановление после аварии — одно сообщение, повтор восстановления молчит', () => {
    const t = new SelfCheckAlertTracker();
    t.noteResult([failed('db')], T0);
    const recovered = t.noteResult([], T0 + 60_000);
    expect(recovered).toContain('снова зелёная');
    expect(t.isOpen).toBe(false);
    expect(t.noteResult([], T0 + 120_000)).toBeNull();
  });

  it('новая авария после восстановления снова даёт первый DM (не молчит как напоминание)', () => {
    const t = new SelfCheckAlertTracker();
    t.noteResult([failed('db')], T0);
    t.noteResult([], T0 + 60_000);
    const text = t.noteResult([failed('caldav')], T0 + 120_000);
    expect(text).toContain('Самопроверка нашла проблему');
    expect(t.isOpen).toBe(true);
  });

  it('reset() возвращает трекер в исходное состояние', () => {
    const t = new SelfCheckAlertTracker();
    t.noteResult([failed('db')], T0);
    t.reset();
    expect(t.isOpen).toBe(false);
    expect(t.noteResult([], T0 + 1)).toBeNull();
  });
});
