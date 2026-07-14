// DTO-рефактор inline-типов @Body() для заметок по схемам/режимам
// (аудит 2026-07, 2г / правило №6 CLAUDE.md).
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SaveNoteDto, SchemaNoteDto, ModeNoteDto } from './notes.dto';

async function errorsFor(
  cls: new () => object,
  body: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(cls, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('SaveNoteDto', () => {
  it('валидное тело проходит', async () => {
    await expect(
      errorsFor(SaveNoteDto, { date: '2026-07-14', text: 'привет' }),
    ).resolves.toEqual([]);
  });

  it('гигантский text — отказ (abuse guard)', async () => {
    await expect(
      errorsFor(SaveNoteDto, {
        date: '2026-07-14',
        text: 'x'.repeat(10001),
      }),
    ).resolves.toContain('text');
  });
});

describe('SchemaNoteDto', () => {
  it('валидное тело с частичными полями проходит', async () => {
    await expect(
      errorsFor(SchemaNoteDto, {
        schemaId: 'abandonment',
        triggers: 'что-то произошло',
      }),
    ).resolves.toEqual([]);
  });

  it('поле длиннее 3000 символов — отказ', async () => {
    await expect(
      errorsFor(SchemaNoteDto, {
        schemaId: 'abandonment',
        feelings: 'x'.repeat(3001),
      }),
    ).resolves.toContain('feelings');
  });
});

describe('ModeNoteDto', () => {
  it('валидное тело проходит', async () => {
    await expect(
      errorsFor(ModeNoteDto, { modeId: 'vulnerable_child', needs: 'опора' }),
    ).resolves.toEqual([]);
  });

  it('лишнее поле — срезается whitelist, не ломает валидацию', async () => {
    await expect(
      errorsFor(ModeNoteDto, {
        modeId: 'vulnerable_child',
        hacked: 'ignored',
      }),
    ).resolves.toEqual([]);
  });
});
