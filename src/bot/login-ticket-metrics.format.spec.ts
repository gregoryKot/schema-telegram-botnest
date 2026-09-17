// Форматтер блока «Вход по коду» для /stats. Пустое состояние обязательно
// (правило №8): на чистой БД отчёт не должен показывать «0/NaN/мусор».
//
// Второй смысл этих тестов — держать честность блока. Доля считается от
// подтверждённых, а не от выписанных кодов, и ни одна строка не называет
// показы людьми: «просили код 40 раз» — это открытия экрана, а не сорок
// человек, и в аварию их число растёт само.
import { formatLoginTicket } from './login-ticket-metrics.format';
import type { LoginTicketMetrics } from './login-ticket-metrics.format';

const m = (over: Partial<LoginTicketMetrics> = {}): LoginTicketMetrics => ({
  issued: 0,
  botOpened: 0,
  confirmed: 0,
  taken: 0,
  tooLate: 0,
  denied: 0,
  ...over,
});

describe('formatLoginTicket', () => {
  it('чистая БД — одна безличная строка, без нулей и NaN', () => {
    const text = formatLoginTicket(m());
    expect(text).toContain('кодом входа не пользовались');
    expect(text).not.toMatch(/NaN|undefined|:\s*0\b/);
  });

  it('код просили, но ни разу не подтвердили — говорит прямо, где обрыв', () => {
    // Это и есть форма аварии: ссылка подтверждения до людей не доходит.
    const text = formatLoginTicket(m({ issued: 40 }));
    expect(text).toContain('Код просили 40 раз');
    expect(text).toContain('ни один не подтвердили');
    expect(text).not.toMatch(/NaN|undefined/);
  });

  it('обычная неделя — показы, подтверждения и «впустило»', () => {
    const text = formatLoginTicket(
      m({ issued: 120, confirmed: 74, taken: 74, botOpened: 60 }),
    );
    expect(text).toContain('Экран входа просил код: 120 раз');
    expect(text).toContain('это показы, не люди');
    expect(text).toContain('Подтвердили вход: 74');
    expect(text).toContain('Приложение впустило: 74 из 74');
    expect(text).toContain('Открывали ссылку в боте: 60');
  });

  it('подтвердили больше, чем впустило — называет разрыв отдельной строкой', () => {
    // Ровно исходная жалоба: «вход прошёл, а приложение осталось на экране».
    const text = formatLoginTicket(m({ issued: 90, confirmed: 50, taken: 31 }));
    expect(text).toContain('Подтвердили, но внутрь так и не попали: 19');
  });

  it('когда впустило всех — строки про разрыв нет', () => {
    const text = formatLoginTicket(m({ issued: 90, confirmed: 50, taken: 50 }));
    expect(text).not.toContain('так и не попали');
  });

  it('нулевые хвосты в отчёт не лезут', () => {
    const text = formatLoginTicket(m({ issued: 10, confirmed: 9, taken: 9 }));
    expect(text).not.toContain('Не успели вовремя');
    expect(text).not.toContain('это не я');
    expect(text).not.toContain('Открывали ссылку в боте');
  });

  it('опоздания и отказы показываются, когда они есть', () => {
    const text = formatLoginTicket(
      m({ issued: 30, confirmed: 20, taken: 20, tooLate: 7, denied: 2 }),
    );
    expect(text).toContain('Не успели вовремя: 7');
    expect(text).toContain('Сказали «это не я»: 2');
  });

  it.each([
    [1, 'раз'],
    [2, 'раза'],
    [5, 'раз'],
    [21, 'раз'],
    [22, 'раза'],
  ])('число %i согласовано со словом «%s»', (issued, word) => {
    const text = formatLoginTicket(m({ issued }));
    expect(text).toContain(`Код просили ${issued} ${word}`);
  });

  it('язык простой: без англицизмов и служебных имён событий', () => {
    const text = formatLoginTicket(
      m({ issued: 30, confirmed: 20, taken: 18, tooLate: 3, denied: 1 }),
    );
    expect(text).not.toMatch(
      /login_ticket|issued|confirmed|too_late|conversion|retention/i,
    );
  });
});
