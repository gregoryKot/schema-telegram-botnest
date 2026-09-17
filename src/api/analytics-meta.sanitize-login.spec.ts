// Санитайзер meta события пути входа. Смысл теста — контроль: пропускать
// ТОЛЬКО известные значения из allow-list, всё остальное отбрасывать целиком.
// Свободный текст и PII в meta недопустимы (правило №7), и молчаливый пропуск
// незнакомого поля превратил бы отчёт о входе в дыру для чужих данных.
import { sanitizeLoginTicketMeta } from './analytics-meta.sanitize-login';
import {
  LOGIN_TICKET_HOSTS,
  LOGIN_TICKET_STEPS,
} from '../analytics/login-ticket-steps.constants';

describe('sanitizeLoginTicketMeta', () => {
  it.each(LOGIN_TICKET_STEPS)('пропускает известный шаг «%s»', (step) => {
    expect(sanitizeLoginTicketMeta({ step, host: 'web' })).toEqual({
      step,
      host: 'web',
    });
  });

  it.each(LOGIN_TICKET_HOSTS)('пропускает известную площадку «%s»', (host) => {
    expect(sanitizeLoginTicketMeta({ step: 'issued', host })).toEqual({
      step: 'issued',
      host,
    });
  });

  it('лишние поля не доезжают до базы', () => {
    expect(
      sanitizeLoginTicketMeta({
        step: 'confirmed',
        host: 'telegram',
        email: 'kot@example.com',
        code: 'K7M2QX94',
      }),
    ).toEqual({ step: 'confirmed', host: 'telegram' });
  });

  it.each([
    ['незнакомый шаг', { step: 'hacked', host: 'web' }],
    ['незнакомая площадка', { step: 'issued', host: 'desktop' }],
    ['шага нет вовсе', { host: 'web' }],
    ['площадки нет вовсе', { step: 'issued' }],
    ['шаг не строка', { step: 7, host: 'web' }],
    ['площадка не строка', { step: 'issued', host: { id: 'web' } }],
    ['пустая meta', {}],
  ])('%s — не пишем ничего', (_name, meta) => {
    expect(
      sanitizeLoginTicketMeta(meta as Record<string, unknown>),
    ).toBeUndefined();
  });

  it('прототипную грязь за значение из списка не принимает', () => {
    // `Set.has` смотрит на собственные значения, но проверка типа обязана
    // отсечь и то, что пришло по цепочке прототипов.
    expect(
      sanitizeLoginTicketMeta({ step: 'toString', host: 'constructor' }),
    ).toBeUndefined();
  });
});
