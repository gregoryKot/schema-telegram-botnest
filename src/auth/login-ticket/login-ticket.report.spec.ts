// Отчёт о пути входа. Проверяем ровно то, от чего зависит честность блока
// «Вход по коду» в /stats: имя события одно, userId всегда null (иначе строку
// можно было бы накрутить с фронта через открытый /api/event), и ошибка
// аналитики не имеет права уронить сам вход.
import { LoginTicketReport } from './login-ticket.report';
import type { AnalyticsService } from '../../analytics/analytics.service';

const build = (track = jest.fn().mockResolvedValue(undefined)) => ({
  track,
  report: new LoginTicketReport({ track } as unknown as AnalyticsService),
});

describe('LoginTicketReport.step', () => {
  it('пишет одно имя события с шагом и площадкой в meta', () => {
    const { track, report } = build();
    report.step('confirmed', 'telegram');
    expect(track).toHaveBeenCalledWith(null, 'login_ticket_step', {
      step: 'confirmed',
      host: 'telegram',
    });
  });

  it('userId всегда null — накрутить отчёт с фронта нечем', () => {
    const { track, report } = build();
    report.step('issued', 'web');
    report.step('taken', 'max');
    for (const [userId] of track.mock.calls) expect(userId).toBeNull();
  });

  it('не ждёт аналитику: вход не должен зависеть от записи события', () => {
    let settled = false;
    const track = jest.fn().mockImplementation(
      () =>
        new Promise((r) =>
          setTimeout(() => {
            settled = true;
            r(undefined);
          }, 50),
        ),
    );
    const { report } = build(track);

    expect(report.step('issued', 'web')).toBeUndefined();
    expect(settled).toBe(false);
  });
});
