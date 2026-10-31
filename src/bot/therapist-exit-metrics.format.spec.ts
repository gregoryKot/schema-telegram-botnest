// Блок «Терапевты уходят» в /stats (правило №8). Пустое состояние — первым:
// на чистой базе отчёт говорит словами, без «0/NaN/undefined».
import {
  formatTherapistExitMetrics,
  TherapistExitMetrics,
} from './therapist-exit-metrics.format';

const zero = { therapists: 0, clients: 0 };

describe('пустая база', () => {
  it('говорит словами, что никто не отказывался, без цифр и NaN', () => {
    const out = formatTherapistExitMetrics({ window: zero, month: zero });
    expect(out).toContain('Терапевты уходят');
    expect(out).toContain(
      'За последние 90 дней никто не отказывался от роли терапевта.',
    );
    expect(out).not.toMatch(/\b0\b/);
    expect(out).not.toContain('NaN');
    expect(out).not.toContain('undefined');
  });
});

describe('обычный отчёт', () => {
  it('за 90 дней и за месяц: сколько терапевтов и скольких клиентов коснулось', () => {
    const m: TherapistExitMetrics = {
      window: { therapists: 3, clients: 11 },
      month: { therapists: 1, clients: 4 },
    };
    const out = formatTherapistExitMetrics(m);
    expect(out).toContain(
      'За последние 90 дней отказались от роли терапевта: 3 человека, клиентов это коснулось: 11.',
    );
    expect(out).toContain(
      'За последний месяц: 1 человек, клиентов это коснулось: 4.',
    );
  });

  it('терапевт без клиентов — без нуля', () => {
    const one = { therapists: 1, clients: 0 };
    const out = formatTherapistExitMetrics({ window: one, month: one });
    expect(out).toContain('1 человек, клиентов это не коснулось');
    expect(out).not.toMatch(/\b0\b/);
  });

  it('в последний месяц отказов не было — так и сказано', () => {
    const out = formatTherapistExitMetrics({
      window: { therapists: 5, clients: 2 },
      month: zero,
    });
    expect(out).toContain('5 человек');
    expect(out).toContain('За последний месяц — никто.');
    expect(out).not.toMatch(/\b0\b/);
  });
});
