// Заметка дня после слияния аккаунтов длиннее предела (хвост волны 2, #1022):
// правка без роста проходит, новая и растущая заметка держат предел 500.
// Связка «слил → сохранил правку → прочитал» — bot.service.settings.spec.ts,
// через настоящий ValidationPipe — test/text-limits.e2e-spec.ts.
import { BadRequestException } from '@nestjs/common';
import { assertDayNoteFits, DAY_NOTE_MERGED_MAX } from './day-note-limit';
import { joinDayNotes } from '../auth/merge-combine-rules';
import { DAY_NOTE_MAX } from '../utils/text-limits';

const ofLen = (n: number) => 'а'.repeat(n);
const stored = (text: string | null) => jest.fn(async () => text);

describe('assertDayNoteFits', () => {
  it('в пределе — проходит, сохранённое даже не читается', async () => {
    const read = stored(null);
    await expect(assertDayNoteFits(ofLen(500), read)).resolves.toBeUndefined();
    expect(read).not.toHaveBeenCalled();
  });

  it('слитая заметка 900: правка той же длины и короче — проходит', async () => {
    const merged = ofLen(900);
    await expect(assertDayNoteFits(ofLen(900), stored(merged))).resolves.toBe(
      undefined,
    );
    await expect(assertDayNoteFits(ofLen(700), stored(merged))).resolves.toBe(
      undefined,
    );
  });

  it('рост сверх сохранённого и новая заметка длиннее предела — 400', async () => {
    const tooLong = assertDayNoteFits(ofLen(901), stored(ofLen(900)));
    await expect(tooLong).rejects.toThrow(BadRequestException);
    const fresh = assertDayNoteFits(ofLen(600), stored(null));
    await expect(fresh).rejects.toThrow(BadRequestException);
    const grows = assertDayNoteFits(ofLen(600), stored(ofLen(400)));
    await expect(grows).rejects.toThrow(BadRequestException);
  });

  it('предел считается как @MaxLength в DTO: 500 эмодзи (1000 UTF-16) — в пределе', async () => {
    const read = stored(null);
    await expect(
      assertDayNoteFits('🙂'.repeat(DAY_NOTE_MAX), read),
    ).resolves.toBeUndefined();
    expect(read).not.toHaveBeenCalled();
  });
});

// Правило №4: потолок DTO обязан вмещать худший случай склейки — две полные
// заметки. Поменяется разделитель в joinDayNotes — тест покраснеет.
it('DAY_NOTE_MERGED_MAX = длина склейки двух заметок по пределу', () => {
  const joined = joinDayNotes(ofLen(DAY_NOTE_MAX), 'б'.repeat(DAY_NOTE_MAX));
  expect(joined.length).toBe(DAY_NOTE_MERGED_MAX);
});
