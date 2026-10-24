// DTO-рефактор inline-типов @Body() для клиентских данных терапевта
// (аудит 2026-07, 2г / правило №6 CLAUDE.md). Отдельный акцент на
// SessionInfoDto: поля принимают string | null | undefined — проверяем,
// что null (сброс даты) не отклоняется валидатором.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  RenameClientDto,
  CreateSessionNoteDto,
  SessionInfoDto,
} from './client-data.dto';

async function errorsFor(
  cls: new () => object,
  body: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(cls, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('RenameClientDto', () => {
  it('alias длиннее 100 — отказ', async () => {
    await expect(
      errorsFor(RenameClientDto, { alias: 'x'.repeat(101) }),
    ).resolves.toContain('alias');
  });
});

describe('CreateSessionNoteDto', () => {
  it('валидное тело проходит', async () => {
    await expect(
      errorsFor(CreateSessionNoteDto, {
        date: '2026-07-14',
        text: 'заметка сессии',
      }),
    ).resolves.toEqual([]);
  });
});

describe('SessionInfoDto', () => {
  it('null сбрасывает дату — проходит', async () => {
    await expect(
      errorsFor(SessionInfoDto, {
        therapyStartDate: null,
        nextSession: null,
      }),
    ).resolves.toEqual([]);
  });

  it('валидная строка даты проходит', async () => {
    await expect(
      errorsFor(SessionInfoDto, { nextSession: '2026-08-01' }),
    ).resolves.toEqual([]);
  });

  it('число вместо строки/null — отказ', async () => {
    await expect(
      errorsFor(SessionInfoDto, { nextSession: 12345 }),
    ).resolves.toContain('nextSession');
  });

  it('meetingDays — массив чисел', async () => {
    await expect(
      errorsFor(SessionInfoDto, { meetingDays: [1, 3, 5] }),
    ).resolves.toEqual([]);
    await expect(
      errorsFor(SessionInfoDto, { meetingDays: ['mon'] }),
    ).resolves.toContain('meetingDays');
  });
});

// Аудит 2026-10, T6: форматы дат и границы дней недели.
describe('SessionInfoDto — форматы (T6)', () => {
  it('therapyStartDate: только YYYY-MM-DD', async () => {
    await expect(
      errorsFor(SessionInfoDto, { therapyStartDate: '2026-01-31' }),
    ).resolves.toEqual([]);
    for (const bad of ['31.01.2026', '2026-01-31T10:00', 'x'.repeat(5000)])
      await expect(
        errorsFor(SessionInfoDto, { therapyStartDate: bad }),
      ).resolves.toContain('therapyStartDate');
  });

  it('nextSession: день или момент (datetime-local сайта), мусор и простыни — отказ', async () => {
    for (const ok of ['2026-08-01', '2026-08-01T14:30', '2026-08-01T14:30:00'])
      await expect(
        errorsFor(SessionInfoDto, { nextSession: ok }),
      ).resolves.toEqual([]);
    for (const bad of ['завтра', '2026-08-01 14:30', 'x'.repeat(5000)])
      await expect(
        errorsFor(SessionInfoDto, { nextSession: bad }),
      ).resolves.toContain('nextSession');
  });

  it('meetingDays: не более 7 элементов, каждый 0–6', async () => {
    await expect(
      errorsFor(SessionInfoDto, { meetingDays: [0, 6] }),
    ).resolves.toEqual([]);
    for (const bad of [[7], [-1], [0, 1, 2, 3, 4, 5, 6, 0], [1.5]])
      await expect(
        errorsFor(SessionInfoDto, { meetingDays: bad }),
      ).resolves.toContain('meetingDays');
  });
});
