// DTO-рефактор inline-типов @Body() для инструментов дневника
// (belief-checks, letters, safe-place, flashcards) — аудит 2026-07, 2г
// / правило №6 CLAUDE.md.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  BeliefCheckDto,
  LetterDto,
  SafePlaceDto,
  FlashcardDto,
} from './tools.dto';

async function errorsFor(
  cls: new () => object,
  body: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(cls, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('BeliefCheckDto', () => {
  const VALID = {
    belief: 'я всегда всё порчу',
    evidenceFor: ['вчера опоздал'],
    evidenceAgainst: ['обычно успеваю'],
  };

  it('валидное тело проходит', async () => {
    await expect(errorsFor(BeliefCheckDto, VALID)).resolves.toEqual([]);
  });

  it('evidenceFor не массив — отказ', async () => {
    await expect(
      errorsFor(BeliefCheckDto, { ...VALID, evidenceFor: 'not-array' }),
    ).resolves.toContain('evidenceFor');
  });

  it('элемент evidenceAgainst длиннее 3000 — отказ', async () => {
    await expect(
      errorsFor(BeliefCheckDto, {
        ...VALID,
        evidenceAgainst: ['x'.repeat(3001)],
      }),
    ).resolves.toContain('evidenceAgainst');
  });

  it('пустое belief — отказ', async () => {
    await expect(
      errorsFor(BeliefCheckDto, { ...VALID, belief: '' }),
    ).resolves.toContain('belief');
  });
});

describe('LetterDto / SafePlaceDto — оба поля опциональны', () => {
  it('пустое тело проходит', async () => {
    await expect(errorsFor(LetterDto, {})).resolves.toEqual([]);
    await expect(errorsFor(SafePlaceDto, {})).resolves.toEqual([]);
  });

  it('текст длиннее 10000 — отказ', async () => {
    await expect(
      errorsFor(LetterDto, { text: 'x'.repeat(10001) }),
    ).resolves.toContain('text');
    await expect(
      errorsFor(SafePlaceDto, { description: 'x'.repeat(10001) }),
    ).resolves.toContain('description');
  });
});

describe('FlashcardDto', () => {
  it('needId из специальных режимов (detached/critic) проходит', async () => {
    await expect(
      errorsFor(FlashcardDto, { modeId: 'x', needId: 'detached' }),
    ).resolves.toEqual([]);
  });

  it('needId вне списка — отказ', async () => {
    await expect(
      errorsFor(FlashcardDto, { modeId: 'x', needId: 'hacked' }),
    ).resolves.toContain('needId');
  });
});
