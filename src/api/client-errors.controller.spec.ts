import { Logger } from '@nestjs/common';
import { ClientErrorsController } from './client-errors.controller';
import { ClientErrorDto } from './dto/client-error.dto';

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
describe('ClientErrorsController', () => {
  let controller: ClientErrorsController;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    controller = new ClientErrorsController();
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => errorSpy.mockRestore());

  const call = () => errorSpy.mock.calls[0] as [string, string];

  it('логирует через .error() с распознаваемым префиксом источника', () => {
    const dto: ClientErrorDto = {
      message: 'Cannot read properties of undefined',
      section: 'DiaryOverlay',
      source: 'webapp',
      stack: 'Error: boom\n  at X',
    };
    controller.report(dto);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [msg, detail] = call();
    expect(msg).toContain('[client:webapp]');
    // Детали (текст ошибки и стек) — во втором аргументе: только stdout.
    expect(detail).toContain('DiaryOverlay');
    expect(detail).toContain('Cannot read properties of undefined');
    expect(detail).toContain('Error: boom\n  at X');
  });

  it('H6: пользовательский текст НЕ попадает в первый аргумент (канал DM)', () => {
    controller.report({
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
    controller.report({ message: 'aaa', section: 'A', source: 'miniapp' });
    controller.report({ message: 'bbb', section: 'B', source: 'miniapp' });
    const first = (errorSpy.mock.calls[0] as [string])[0];
    const second = (errorSpy.mock.calls[1] as [string])[0];
    // Разный пользовательский ввод — одинаковый ключ алерта.
    expect(first).toBe(second);
  });

  it('H0: initData мини-аппа из фрагмента URL не попадает НИКУДА', () => {
    const initDataHref =
      'https://schemehappens.ru/app/#tgWebAppData=query_id%3DAAH%26user%3D%257B%2522id%2522%253A279058397%257D%26auth_date%3D1716922846%26hash%3Dc501b71e775f74ce10e377dea85a7ea24ecd640b223ea86dfe453e0eaed2e2b2';
    controller.report({
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
    controller.report({
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
    controller.report({
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
    controller.report({
      message: 'boom',
      section: 'Sections',
      source: 'miniapp',
      componentStack: '\n  in App',
    });
    const [, detail] = call();
    expect(detail).toContain('in App');
  });
});
