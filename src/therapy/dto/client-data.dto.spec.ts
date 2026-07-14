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
