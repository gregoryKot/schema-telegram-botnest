// Блок «Настройки: переменные» /stats (правило №8) — включая пустое
// состояние: на чистом дереве отчёт обязан говорить «всё в порядке», а не
// показывать 0/NaN/мусор.
import { formatEnvCheckReport } from './env-check.format';
import { EnvCheckResult } from '../infra/env-check';
import { ENV_REGISTRY } from '../infra/env-registry.entries';

const EMPTY: EnvCheckResult = {
  missing: [],
  invalid: [],
  crossCheckIssues: [],
};

describe('formatEnvCheckReport', () => {
  it('пустое состояние — «все N переменных в порядке», без 0/NaN/мусора', () => {
    const text = formatEnvCheckReport(EMPTY);
    expect(text).toContain(`все ${ENV_REGISTRY.length} переменных в порядке`);
    expect(text).not.toMatch(/NaN|undefined|null/);
  });

  it('есть проблемы — заголовок + маркированный список простым языком', () => {
    const text = formatEnvCheckReport({
      missing: ['BOT_TOKEN'],
      invalid: [
        {
          name: 'ADMIN_ID',
          problem: 'не похоже на Telegram id (ожидались только цифры)',
        },
      ],
      crossCheckIssues: [
        {
          id: 'x',
          problem: 'RESEND_API_KEY задан, но не задан(ы) ADMIN_EMAIL',
        },
      ],
    });
    expect(text).toContain('Настройки: переменные');
    expect(text).toContain('• не задано: BOT_TOKEN');
    expect(text).toContain(
      '• неверный формат ADMIN_ID: не похоже на Telegram id',
    );
    expect(text).toContain(
      '• RESEND_API_KEY задан, но не задан(ы) ADMIN_EMAIL',
    );
  });
});
