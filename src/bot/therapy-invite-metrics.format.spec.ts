import {
  formatTherapyInviteMetrics,
  TherapyInviteMetrics,
} from './therapy-invite-metrics.format';

const zero = { new: 0, offline: 0 };
function metrics(over: Partial<TherapyInviteMetrics> = {}) {
  return {
    created: zero,
    joined: zero,
    revoked: zero,
    confirmed: zero,
    denied: zero,
    ...over,
  };
}
const TITLE = '✉️ <b>Приглашения клиентов</b> (за 30 дней)';

describe('formatTherapyInviteMetrics', () => {
  it('пустая БД: заголовок и «Пока ничего.», без нулей и мусора', () => {
    const out = formatTherapyInviteMetrics(metrics());
    expect(out).toBe(`${TITLE}\nПока ничего.`);
    expect(out).not.toMatch(/NaN|undefined|null|\b0\b/);
  });

  it('полный набор: три строки, хвост «из них» у создания и подключения', () => {
    const out = formatTherapyInviteMetrics(
      metrics({
        created: { new: 5, offline: 2 },
        joined: { new: 3, offline: 2 },
        revoked: { new: 1, offline: 0 },
      }),
    );
    expect(out).toBe(
      [
        TITLE,
        'Создали приглашений: 7, из них из офлайн-карточки 2.',
        'Подключились по коду: 5, из них из офлайн-карточки 2.',
        'Отозвали: 1.',
      ].join('\n'),
    );
  });

  it('только обычные: без хвоста «из них», пустые шаги не выводятся', () => {
    const out = formatTherapyInviteMetrics(
      metrics({ created: { new: 4, offline: 0 } }),
    );
    expect(out).toBe(`${TITLE}\nСоздали приглашений: 4.`);
    expect(out).not.toContain('из них');
  });

  it('только отзыв', () => {
    const out = formatTherapyInviteMetrics(
      metrics({ revoked: { new: 0, offline: 2 } }),
    );
    expect(out).toBe(`${TITLE}\nОтозвали: 2, из них из офлайн-карточки 2.`);
  });

  it('сверка карточки: «да/нет» одной строкой, без хвоста «из них»', () => {
    const out = formatTherapyInviteMetrics(
      metrics({
        confirmed: { new: 0, offline: 3 },
        denied: { new: 0, offline: 1 },
      }),
    );
    expect(out).toBe(
      `${TITLE}\nКод из офлайн-карточки ввёл тот же человек: да 3, нет 1.`,
    );
  });

  it('только отказы: «да 0» в строке сверки законен', () => {
    const out = formatTherapyInviteMetrics(
      metrics({ denied: { new: 0, offline: 2 } }),
    );
    expect(out).toContain('ввёл тот же человек: да 0, нет 2.');
  });
});
