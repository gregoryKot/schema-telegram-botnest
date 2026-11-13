// Санитайзер meta события пути входа. Смысл теста — контроль: пропускать
// ТОЛЬКО известные значения из allow-list, всё остальное отбрасывать целиком.
// Свободный текст и PII в meta недопустимы (правило №7), и молчаливый пропуск
// незнакомого поля превратил бы отчёт о входе в дыру для чужих данных.
import {
  sanitizeLoginMeta,
  sanitizeLoginTicketMeta,
} from './analytics-meta.sanitize-login';
import { sanitizeMeta } from './analytics-meta.sanitize';
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

// Окно Google One Tap (аудит 2026-10, правило №8): событие пишет сервер; из
// meta пропускается только outcome из закрытого списка.
describe('sanitizeMeta: login_one_tap', () => {
  it.each(['signed_in', 'twofa', 'rejected'])(
    'пропускает исход «%s»',
    (outcome) => {
      expect(
        sanitizeMeta('login_one_tap', { outcome, email: 'a@b.c' }),
      ).toEqual({
        outcome,
      });
    },
  );

  it.each([
    { outcome: 'hacked' },
    { outcome: 1 },
    {},
    { step: 'issued', host: 'web' },
  ])('чужое значение или поле — meta целиком отбрасывается: %j', (meta) => {
    expect(sanitizeMeta('login_one_tap', meta)).toBeUndefined();
  });

  it('контроль: шаг билета по-прежнему проходит через ту же ветку', () => {
    expect(
      sanitizeMeta('login_ticket_step', { step: 'issued', host: 'web' }),
    ).toEqual({
      step: 'issued',
      host: 'web',
    });
  });
});

// Карточка «добавь почту или VK ID» внутри Telegram (2026-11): событие шлёт
// клиент, из meta проходит только действие из закрытого списка.
describe('sanitizeMeta: login_method_offer', () => {
  it.each(['shown', 'open', 'later'])('пропускает действие «%s»', (action) => {
    expect(
      sanitizeMeta('login_method_offer', { action, email: 'a@b.c' }),
    ).toEqual({ action });
  });

  it.each([{ action: 'hacked' }, { action: 1 }, {}, { outcome: 'signed_in' }])(
    'чужое значение или поле — meta целиком отбрасывается: %j',
    (meta) => {
      expect(sanitizeMeta('login_method_offer', meta)).toBeUndefined();
    },
  );
});

// login_oauth пишет сервер (src/auth/oauth-login.report.ts), с клиента оно в
// отчёт не попадает (у клиентской строки есть userId). Ветка — на случай
// запроса руками: в базу доедут только провайдер и исход из закрытых списков.
describe('login_oauth — вход через VK ID и Яндекс ID', () => {
  it('ветка login_* доводит событие до санитайзера', () => {
    expect(
      sanitizeLoginMeta('login_oauth', {
        provider: 'yandex',
        outcome: 'signed_up',
      }),
    ).toEqual({ provider: 'yandex', outcome: 'signed_up' });
  });

  it('через общий sanitizeMeta: лишние поля срезаны', () => {
    expect(
      sanitizeMeta('login_oauth', {
        provider: 'vk',
        outcome: 'linked',
        email: 'kot@example.com',
        providerId: '42',
      }),
    ).toEqual({ provider: 'vk', outcome: 'linked' });
  });

  it.each([
    ['провайдер не из списка', { provider: 'google', outcome: 'signed_in' }],
    ['исход не из списка', { provider: 'yandex', outcome: 'failed' }],
    ['пустая meta', {}],
  ])('%s — не пишем ничего', (_name, meta) => {
    expect(sanitizeMeta('login_oauth', meta)).toBeUndefined();
  });

  it('контроль: незнакомое login_*-событие по-прежнему отбрасывается', () => {
    expect(
      sanitizeLoginMeta('login_unknown', {
        provider: 'yandex',
        outcome: 'signed_in',
      }),
    ).toBeUndefined();
  });
});
