// Рантайм-валидация разбора фразы (правило №6): id примет приходят от
// клиента, поэтому выдуманное значение обязано отбиваться до сервиса —
// иначе в БД накопятся приметы, которых в упражнении нет.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PhraseCheckDto } from './phrase-check.dto';
import { PHRASE_MARK_IDS } from '../../bot/phrase-check.constants';

async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(PhraseCheckDto, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

const VALID = { phrase: 'ни на что не гожусь', marks: ['person', 'worth'] };

describe('PhraseCheckDto', () => {
  it('валидное тело проходит', async () => {
    await expect(errorsFor(VALID)).resolves.toEqual([]);
  });

  it('все приметы разом — валидны', async () => {
    await expect(
      errorsFor({ ...VALID, marks: [...PHRASE_MARK_IDS] }),
    ).resolves.toEqual([]);
  });

  it('пустая фраза — отказ', async () => {
    await expect(errorsFor({ ...VALID, phrase: '' })).resolves.toContain(
      'phrase',
    );
  });

  it('выдуманная примета — отказ', async () => {
    await expect(
      errorsFor({ ...VALID, marks: ['person', 'выдумка'] }),
    ).resolves.toContain('marks');
  });

  it('marks не массив — отказ', async () => {
    await expect(errorsFor({ ...VALID, marks: 'person' })).resolves.toContain(
      'marks',
    );
  });

  it('приметы длиннее реестра — отказ (защита от раздувания записи)', async () => {
    await expect(
      errorsFor({ ...VALID, marks: [...PHRASE_MARK_IDS, 'person'] }),
    ).resolves.toContain('marks');
  });

  it('фраза длиннее 3000 — отказ', async () => {
    await expect(
      errorsFor({ ...VALID, phrase: 'я'.repeat(3001) }),
    ).resolves.toContain('phrase');
  });

  it('переформулировка необязательна', async () => {
    await expect(errorsFor({ ...VALID, rewrite: undefined })).resolves.toEqual(
      [],
    );
  });
});
