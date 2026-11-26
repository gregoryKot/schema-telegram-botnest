// Ручки .ics шага плана (аудит 2026-11, E6): POST выдаёт ссылку под входом,
// GET отдаёт файл без входа — его открывает внешний браузер. Здесь шов
// «выдал ссылку → открыл файл» через контроллер и границы DTO; печать
// токена и текст файла — practice-ics.spec.ts.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { loadWithKeys } from '../test-support/load-with-keys';
import { PracticeIcsLinkDto } from './dto/practice-ics.dto';

type Ctrl = typeof import('./practice-ics.controller');
const load = (key: string): Ctrl =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  loadWithKeys({ key }, () => require('./practice-ics.controller') as Ctrl);

const BODY = {
  text: 'Позвонить маме',
  needLabel: 'Привязанность',
  startMs: Date.UTC(2026, 10, 9, 16),
};

function fakeRes() {
  const headers: Record<string, string> = {};
  const res = {
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
  };
  return { res: res as never, headers };
}

describe('PracticeIcsController', () => {
  const ctrl = new (load('a'.repeat(64)).PracticeIcsController)();

  it('выдал ссылку → по ней открывается файл календаря с тем же шагом', () => {
    const { path } = ctrl.createLink(BODY);
    expect(path).toMatch(/^\/api\/plan\/ics\/[A-Za-z0-9_-]+$/);
    expect(path).not.toContain('маме');
    const { res, headers } = fakeRes();
    const text = ctrl.getFile(path.split('/').pop()!, res);
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('Позвонить маме');
    expect(headers).toEqual({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="practice.ics"',
    });
  });

  it('битый или чужой токен — 404 «ссылка устарела», заголовков файла нет', () => {
    const { res, headers } = fakeRes();
    expect(() => ctrl.getFile('not-a-token', res)).toThrow(
      expect.objectContaining({
        status: 404,
        message: 'Ссылка на файл календаря устарела',
      }),
    );
    expect(headers).toEqual({});
  });
});

describe('PracticeIcsLinkDto', () => {
  const errors = async (body: Record<string, unknown>) =>
    (await validate(plainToInstance(PracticeIcsLinkDto, body))).map(
      (e) => e.property,
    );

  it('шаг плана с текстом, потребностью и началом в мс — проходит', async () => {
    expect(await errors(BODY)).toEqual([]);
  });

  it('пустые строки, мусор вместо числа и время вне 1970–2100 — отказ', async () => {
    expect(await errors({ ...BODY, text: '' })).toEqual(['text']);
    expect(await errors({ ...BODY, needLabel: 'x'.repeat(61) })).toEqual([
      'needLabel',
    ]);
    expect(await errors({ ...BODY, startMs: 1.5 })).toEqual(['startMs']);
    expect(await errors({ ...BODY, startMs: -1 })).toEqual(['startMs']);
    expect(
      await errors({ ...BODY, startMs: Date.UTC(2100, 0, 1) + 1 }),
    ).toEqual(['startMs']);
  });
});
