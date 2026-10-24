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
// счёт постоянного первого аргумента у AlertLogger). Теперь он ещё и СЧИТАЕТСЯ
// (событие client_error, meta.source + meta.section).
//
// Находка аудита 2026-10-11: полный detail (до ~5 КБ) писался в stdout на
// КАЖДЫЙ анонимный запрос и вытеснял ротацией логи настоящей аварии. Лог и
// счётчик теперь решает один вердикт ClientErrorLogGate: подробно — раз на
// source+section+ip за 5 минут и не больше K в минуту на всех. Тесты ниже
// проверяют оба слоя; время — фейковые таймеры (окна считаются по Date.now).
//
// Состояние троттлов — поле экземпляра контроллера, поэтому каждый тест
// получает чистый бюджет. По умолчанию каждый вызов report() — ДРУГОЕ
// устройство (nextIp()): тесты про один и тот же IP передают его явно.
describe('ClientErrorsController', () => {
  let controller: ClientErrorsController;
  let errorSpy: jest.SpyInstance;
  let track: jest.Mock;
  let ipSeq = 0;
  const nextIp = () => `10.0.0.${++ipSeq}`;
  const req = (ip: string = nextIp()): Request => ({ ip }) as Request;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-16T12:00:00Z') });
    track = jest.fn().mockResolvedValue(undefined);
    const analytics = { track } as unknown as AnalyticsService;
    controller = new ClientErrorsController(analytics);
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    jest.useRealTimers();
  });

  const call = () => errorSpy.mock.calls[0] as [string, string];
  const report = (dto: ClientErrorDto, ip?: string) =>
    controller.report(dto, req(ip));

  it('логирует через .error() с распознаваемым префиксом источника и секции', () => {
    const dto: ClientErrorDto = {
      message: 'Cannot read properties of undefined',
      section: 'DiaryOverlay',
      source: 'webapp',
      stack: 'Error: boom\n  at X',
    };
    report(dto);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [msg, detail] = call();
    // 'DiaryOverlay' не в allow-list classifyClientErrorSection → бакет 'other'.
    expect(msg).toContain('[client:webapp/other]');
    // Детали (текст ошибки и стек) — во втором аргументе: только stdout.
    expect(detail).toContain('DiaryOverlay');
    expect(detail).toContain('Cannot read properties of undefined');
    expect(detail).toContain('Error: boom\n  at X');
  });

  it('известная секция попадает в первый аргумент каноническим бакетом ([client:webapp/auth])', () => {
    report({ message: 'boom', section: 'auth', source: 'webapp' });
    const [msg] = call();
    expect(msg).toContain('[client:webapp/auth]');
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

    it('шквал одинаковых отчётов (тот же source+section+ip) — ОДНА строка в аналитике и ОДНА в логе', () => {
      const ip = nextIp();
      for (let i = 0; i < 20; i += 1) {
        report(
          { message: `boom ${i}`, section: 'Профиль', source: 'miniapp' },
          ip,
        );
      }
      // Находка аудита 2026-10-11: раньше лог не троттлился и срабатывал все 20 раз.
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect((errorSpy.mock.calls[0] as [string, string])[1]).toContain(
        'boom 0',
      );
      // Счётчик — ровно один раз, несмотря на разный текст message.
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

  // ─── Шквал: защита логов (находка аудита 2026-10-11) ─────────────────────
  describe('шквал отчётов', () => {
    const dto = (message = 'boom'): ClientErrorDto => ({
      message,
      section: 'Профиль',
      source: 'miniapp',
    });

    it('после окна 5 мин следующий отчёт пишет detail с числом проглоченных и шлёт meta.suppressed', () => {
      const ip = nextIp();
      for (let i = 0; i < 20; i += 1) report(dto(`boom ${i}`), ip);
      expect(errorSpy).toHaveBeenCalledTimes(1);

      jest.setSystemTime(Date.now() + 5 * 60_000);
      report(dto('boom again'), ip);

      expect(errorSpy).toHaveBeenCalledTimes(2);
      const [msg, detail] = errorSpy.mock.calls[1] as [string, string];
      expect(detail).toContain('boom again');
      expect(detail).toContain(
        'повторов с этого устройства за прошлое окно: 19',
      );
      // Число — только во втором аргументе (stdout), первый по-прежнему постоянный.
      expect(msg).not.toMatch(/\b19\b/);
      expect(track).toHaveBeenLastCalledWith(null, 'client_error', {
        source: 'miniapp',
        section: 'profile',
        suppressed: 19,
      });
    });

    it('внутри окна у первого отчёта нет ни suppressed, ни unlogged', () => {
      report(dto(), nextIp());
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect((errorSpy.mock.calls[0] as [string, string])[1]).not.toContain(
        'повторов',
      );
      expect(track.mock.calls[0][2]).toEqual({
        source: 'miniapp',
        section: 'profile',
      });
    });

    it('общий бюджет: 25 отчётов с РАЗНЫХ IP за минуту — подробно ровно 20, считаются все 25', () => {
      for (let i = 0; i < 25; i += 1) report(dto(`boom ${i}`));
      expect(errorSpy).toHaveBeenCalledTimes(20);
      expect(track).toHaveBeenCalledTimes(25);
      const unlogged = track.mock.calls.filter(
        (c) => (c[2] as { unlogged?: boolean }).unlogged === true,
      );
      expect(unlogged).toHaveLength(5);
      // Первые 20 — без пометки: бюджет тратится по порядку прихода.
      expect(track.mock.calls[19][2]).not.toHaveProperty('unlogged');
      expect(track.mock.calls[20][2]).toEqual({
        source: 'miniapp',
        section: 'profile',
        unlogged: true,
      });
    });

    it('бюджет обновляется через минуту: следующий отчёт снова пишется подробно', () => {
      for (let i = 0; i < 21; i += 1) report(dto());
      expect(errorSpy).toHaveBeenCalledTimes(20);
      jest.setSystemTime(Date.now() + 60_000);
      report(dto());
      expect(errorSpy).toHaveBeenCalledTimes(21);
      expect((errorSpy.mock.calls[20] as [string, string])[0]).toContain(
        '[client:miniapp/profile]',
      );
    });

    it('перебор IP снимает per-device слой (>500 ключей), но потолок логов держит', () => {
      // 600 разных IP × 1 отчёт: AlertThrottle сбрасывается при >500 ключах и
      // пускает всё, глобальный бюджет — нет.
      for (let i = 0; i < 600; i += 1)
        report(dto(), `172.16.${i >> 8}.${i % 256}`);
      expect(errorSpy).toHaveBeenCalledTimes(20);
      expect(track).toHaveBeenCalledTimes(600);
      const unlogged = track.mock.calls.filter(
        (c) => (c[2] as { unlogged?: boolean }).unlogged === true,
      );
      expect(unlogged).toHaveLength(580);
    });

    it('контроль: до потолка разные IP и разные секции пишутся каждый раз', () => {
      const ip = nextIp();
      report({ message: 'a', section: 'Дневник', source: 'webapp' }, ip);
      report({ message: 'b', section: 'Паттерны', source: 'webapp' }, ip);
      report({ message: 'c', section: 'Дневник', source: 'miniapp' }, ip);
      report({ message: 'd', section: 'Дневник', source: 'webapp' });
      expect(errorSpy).toHaveBeenCalledTimes(4);
      expect(
        track.mock.calls.map((c) => (c[2] as { section: string }).section),
      ).toEqual(['diary', 'schemas', 'diary', 'diary']);
    });

    it('detail по-прежнему чистится от секретов и при повторе после окна', () => {
      const ip = nextIp();
      report(dto(), ip);
      jest.setSystemTime(Date.now() + 5 * 60_000);
      report(
        { ...dto(), url: 'https://schemehappens.ru/app/#tgWebAppData=SECRET' },
        ip,
      );
      expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('SECRET');
    });
  });

  // M8 (аудит 2026-10): стек и сообщение несут location.href с живой подписью.
  it('M8: initData/JWT из фрагмента в stack, message и componentStack не доезжают до лога', () => {
    const leak = 'AAH-secret-initdata-signature-0123456789';
    report({
      message: `Navigation failed at https://schemehappens.ru/app/#tgWebAppData=${leak}`,
      section: 'Sections',
      source: 'miniapp',
      stack:
        `Error: boom\n  at load (https://schemehappens.ru/app/#tgWebAppData=${leak}&tgWebAppVersion=7)\n` +
        `  at route (https://schemehappens.ru/#access_token=${leak})\n  raw #tgWebAppData=${leak}`,
      componentStack: `at Screen (https://x.ru/p?token=${leak})`,
    });
    const serialized = JSON.stringify(errorSpy.mock.calls);
    expect(serialized).not.toContain(leak);
    // остальное сообщение и стек сохраняются — режется только хвост со ссылкой
    const [, detail] = call();
    expect(detail).toContain(
      'Navigation failed at https://schemehappens.ru/app/',
    );
    expect(detail).toContain('at load (https://schemehappens.ru/app/');
  });

  it('M8: componentStack (если нет stack) тоже чистится', () => {
    report({
      message: 'boom',
      section: 'Sections',
      source: 'webapp',
      componentStack: 'at X https://x.ru/p#access_token=SECRETJWT',
    });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('SECRETJWT');
  });
});
