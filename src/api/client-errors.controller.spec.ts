import { Logger } from '@nestjs/common';
import type { Request } from 'express';
import { ClientErrorsController } from './client-errors.controller';
import type { ClientErrorDto } from './dto/client-error.dto';
import type { AnalyticsService } from '../analytics/analytics.service';

// Best-practice «видимость прода» (2026-07): краш фронтенда обязан доехать
// до AlertLogger (→ DM админу).
//
// Регрессия аудита 2026-07-20 (H0/H6). AlertLogger отправляет в Telegram
// админу ТОЛЬКО первый аргумент .error(); optionalParams идут лишь в stdout.
// Поэтому первый аргумент обязан быть постоянным и не содержать ничего
// клиентского:
//   • H0 — раньше туда клался body.url целиком, а во фрагменте URL живут
//     ЖИВЫЕ креденшелы: initData мини-аппа с подписью (реплей 1 ч = полная
//     имперсонация) и `#access_token=<JWT>` вебаппа (TTL 15 мин);
//   • H6 — раньше туда клались section/message, то есть аноним доставлял
//     произвольный текст в личку админа и, варьируя буквы, обходил троттл
//     (он нормализует только цифры) — фишинг + утопление настоящих алертов.
//
// Волна 9 щита покрытия (docs/SHIELD_PROMPT.md): раньше отчёт только
// логировался (де-факто невидим — разные ошибки схлопываются в один DM за
// счёт постоянного первого аргумента у AlertLogger). Теперь каждый отчёт ещё
// и СЧИТАЕТСЯ (событие client_error, meta.source + meta.section), отдельным
// троттлингом от лога — тесты ниже проверяют оба канала раздельно.
//
// REPORT_THROTTLE в client-errors.controller.ts — модульная константа
// (общая для всех вызовов процесса, не поле класса — так же, как
// EVENT_THROTTLE в auth-failure.report.ts). Поэтому каждый вызов report() в
// этом файле получает СВОЙ IP (nextIp()) — иначе тесты внутри одного файла
// делили бы окно троттлинга друг с другом и ловили бы чужой allow=false.
describe('ClientErrorsController', () => {
  let controller: ClientErrorsController;
  let errorSpy: jest.SpyInstance;
  let track: jest.Mock;
  let ipSeq = 0;
  const nextIp = () => `10.0.0.${++ipSeq}`;
  const req = (ip: string = nextIp()): Request => ({ ip }) as Request;

  beforeEach(() => {
    track = jest.fn().mockResolvedValue(undefined);
    const analytics = { track } as unknown as AnalyticsService;
    controller = new ClientErrorsController(analytics);
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => errorSpy.mockRestore());

  const call = () => errorSpy.mock.calls[0] as [string, string];
  const report = (dto: ClientErrorDto, ip?: string) =>
    controller.report(dto, req(ip));

  it('логирует через .error() с распознаваемым префиксом источника', () => {
    const dto: ClientErrorDto = {
      message: 'Cannot read properties of undefined',
      section: 'DiaryOverlay',
      source: 'webapp',
      stack: 'Error: boom\n  at X',
    };
    report(dto);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [msg, detail] = call();
    expect(msg).toContain('[client:webapp]');
    // Детали (текст ошибки и стек) — во втором аргументе: только stdout.
    expect(detail).toContain('DiaryOverlay');
    expect(detail).toContain('Cannot read properties of undefined');
    expect(detail).toContain('Error: boom\n  at X');
  });

  it('H6: пользовательский текст НЕ попадает в первый аргумент (канал DM)', () => {
    report({
      message: '🚨 Срочно! Переведите деньги на кошелёк attacker',
      section: '<b>fake-admin-alert</b>',
      source: 'webapp',
    });
    const [msg] = call();
    expect(msg).not.toContain('Переведите');
    expect(msg).not.toContain('fake-admin-alert');
    expect(msg).not.toContain('attacker');
  });

  it('H6: первый аргумент постоянен для источника → троттл не обойти', () => {
    report({ message: 'aaa', section: 'A', source: 'miniapp' });
    report({ message: 'bbb', section: 'B', source: 'miniapp' });
    const first = (errorSpy.mock.calls[0] as [string])[0];
    const second = (errorSpy.mock.calls[1] as [string])[0];
    // Разный пользовательский ввод — одинаковый ключ алерта.
    expect(first).toBe(second);
  });

  it('H0: initData мини-аппа из фрагмента URL не попадает НИКУДА', () => {
    const initDataHref =
      'https://schemehappens.ru/app/#tgWebAppData=query_id%3DAAH%26user%3D%257B%2522id%2522%253A279058397%257D%26auth_date%3D1716922846%26hash%3Dc501b71e775f74ce10e377dea85a7ea24ecd640b223ea86dfe453e0eaed2e2b2';
    report({
      message: 'boom',
      section: 'Sections',
      source: 'miniapp',
      url: initDataHref,
    });
    const [msg, detail] = call();
    for (const out of [msg, detail]) {
      expect(out).not.toContain('tgWebAppData');
      expect(out).not.toContain('hash%3D');
      expect(out).not.toContain('c501b71e775f74ce10e377dea85a7ea24ecd640b');
    }
    // Путь для диагностики сохраняется — но только он.
    expect(detail).toContain('url=https://schemehappens.ru/app/');
  });

  it('H0: access-токен вебаппа из фрагмента не попадает НИКУДА', () => {
    report({
      message: 'render crash',
      section: 'AuthCallback',
      source: 'webapp',
      url: 'https://schemehappens.ru/auth/callback#access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.SIGNATURE&expires_in=900',
    });
    const [msg, detail] = call();
    for (const out of [msg, detail]) {
      expect(out).not.toContain('access_token');
      expect(out).not.toContain('eyJhbGciOiJIUzI1NiJ9');
      expect(out).not.toContain('SIGNATURE');
    }
    expect(detail).toContain('url=https://schemehappens.ru/auth/callback');
  });

  it('query-строка тоже срезается (токены утекали и через ?token=)', () => {
    report({
      message: 'boom',
      section: 'S',
      source: 'webapp',
      url: 'https://schemehappens.ru/verify?token=secret-magic-link-token',
    });
    const [, detail] = call();
    expect(detail).not.toContain('secret-magic-link-token');
    expect(detail).toContain('url=https://schemehappens.ru/verify');
  });

  it('падает обратно на componentStack, когда stack не передан', () => {
    report({
      message: 'boom',
      section: 'Sections',
      source: 'miniapp',
      componentStack: '\n  in App',
    });
    const [, detail] = call();
    expect(detail).toContain('in App');
  });

  // ─── Счётчик (событие client_error) ────────────────────────────────────
  describe('счётчик client_error', () => {
    it('пишет структурную meta: source + канонический бакет section, userId = null', () => {
      report({ message: 'boom', section: 'Дневник', source: 'webapp' });
      expect(track).toHaveBeenCalledWith(null, 'client_error', {
        source: 'webapp',
        section: 'diary',
      });
    });

    it('незнакомая секция бакетится в other, а не улетает как есть', () => {
      report({
        message: 'boom',
        section: 'СовсемНовыйЭкран',
        source: 'miniapp',
      });
      expect(track).toHaveBeenCalledWith(null, 'client_error', {
        source: 'miniapp',
        section: 'other',
      });
    });

    it('шквал одинаковых отчётов (тот же source+section+ip) — ОДНА строка в аналитике', () => {
      const ip = nextIp();
      for (let i = 0; i < 20; i += 1) {
        report(
          { message: `boom ${i}`, section: 'Профиль', source: 'miniapp' },
          ip,
        );
      }
      // Лог не троттлится — он должен сработать все 20 раз.
      expect(errorSpy).toHaveBeenCalledTimes(20);
      // А счётчик — ровно один раз, несмотря на разный текст message.
      expect(track).toHaveBeenCalledTimes(1);
      expect(track).toHaveBeenCalledWith(null, 'client_error', {
        source: 'miniapp',
        section: 'profile',
      });
    });

    it('разные секции в том же окне — ДВЕ строки', () => {
      const ip = nextIp();
      report({ message: 'a', section: 'Дневник', source: 'webapp' }, ip);
      report({ message: 'b', section: 'Паттерны', source: 'webapp' }, ip);
      expect(track).toHaveBeenCalledTimes(2);
      expect(track).toHaveBeenNthCalledWith(1, null, 'client_error', {
        source: 'webapp',
        section: 'diary',
      });
      expect(track).toHaveBeenNthCalledWith(2, null, 'client_error', {
        source: 'webapp',
        section: 'schemas',
      });
    });

    it('разные площадки (source) с той же секцией — ДВЕ строки', () => {
      const ip = nextIp();
      report({ message: 'a', section: 'Паттерны', source: 'webapp' }, ip);
      report({ message: 'b', section: 'Паттерны', source: 'miniapp' }, ip);
      expect(track).toHaveBeenCalledTimes(2);
      expect(track).toHaveBeenNthCalledWith(1, null, 'client_error', {
        source: 'webapp',
        section: 'schemas',
      });
      expect(track).toHaveBeenNthCalledWith(2, null, 'client_error', {
        source: 'miniapp',
        section: 'schemas',
      });
    });

    it('разные IP с тем же source+section — тоже ДВЕ строки (ключ включает ip)', () => {
      report({ message: 'a', section: 'auth', source: 'webapp' }, '9.9.9.9');
      report({ message: 'b', section: 'auth', source: 'webapp' }, '8.8.8.8');
      expect(track.mock.calls).toEqual([
        [null, 'client_error', { source: 'webapp', section: 'auth' }],
        [null, 'client_error', { source: 'webapp', section: 'auth' }],
      ]);
    });
  });
});
