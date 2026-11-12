// Форматтер строки «Окно Google „Продолжить как…“» для /stats (правило №8).
// Пустое состояние обязательно: на чистой БД — одна безличная строка, без
// нулей и NaN. И честность: окно, которое ни разу не впустило, но отказы есть,
// названо прямо — это форма поломки (разъехался client id).
import { formatOneTap, type OneTapMetrics } from './one-tap-metrics.format';

const m = (over: Partial<OneTapMetrics> = {}): OneTapMetrics => ({
  signedIn: 0,
  twofa: 0,
  rejected: 0,
  ...over,
});

describe('formatOneTap', () => {
  it('чистая БД — одна строка без чисел, NaN и терминов', () => {
    const text = formatOneTap(m());
    expect(text).toContain('Окно Google «Продолжить как…»');
    expect(text).toContain(
      'За неделю через окно не входили: вход через Google убран.',
    );
    expect(text).not.toMatch(/NaN|undefined|\d|One Tap|credential/);
  });

  it('входы и второй фактор — простыми словами', () => {
    const text = formatOneTap(m({ signedIn: 12, twofa: 2 }));
    expect(text).toContain('Вошли одним касанием: 12');
    expect(text).toContain('Дошли до кода второго шага: 2');
    expect(text).not.toContain('Сервер не принял');
  });

  it('только отказы — говорит прямо, где поломка', () => {
    const text = formatOneTap(m({ rejected: 5 }));
    expect(text).toContain('Сервер не принял вход из окна: 5');
    expect(text).toContain('ни одного входа');
  });

  it('отказы рядом со входами — отдельной строкой без тревоги', () => {
    const text = formatOneTap(m({ signedIn: 30, rejected: 1 }));
    expect(text).toContain('Вошли одним касанием: 30');
    expect(text).toContain('Сервер не принял вход из окна: 1');
    expect(text).not.toContain('ни одного входа');
  });
});
