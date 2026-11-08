import { BadRequestException } from '@nestjs/common';
import { maxLength } from 'class-validator';
import { DAY_NOTE_MAX } from '../utils/text-limits';

// Заметка дня длиннее DAY_NOTE_MAX бывает только после слияния аккаунтов:
// joinDayNotes (src/auth/merge-combine-rules.ts) склеивает две заметки одного
// дня через пустую строку и не режет — обрезка потеряла бы текст человека
// (хвост волны 2, #1022). Раньше такую заметку нельзя было сохранить вообще:
// любая правка упиралась в @MaxLength(500) и отвечала 400.
//
// Правило: текст в пределе проходит всегда; длиннее предела — только если он
// не длиннее уже сохранённого (правка без роста: исправить, сократить). Новая
// заметка и дописывание держат предел, как раньше. DTO пускает до потолка
// слитой заметки (DAY_NOTE_MERGED_MAX), остальное решает сервис — у него есть
// сохранённый текст.

/** Потолок DTO: две заметки по DAY_NOTE_MAX и разделитель `\n\n` (joinDayNotes). */
export const DAY_NOTE_MERGED_MAX = DAY_NOTE_MAX * 2 + 2;

/**
 * 400, если текст длиннее предела и длиннее сохранённого. Сохранённое
 * читается только для длинного текста: обычное сохранение лишнего запроса
 * не делает. Предел считается так же, как @MaxLength в DTO (class-validator).
 */
export async function assertDayNoteFits(
  text: string,
  readStored: () => Promise<string | null>,
): Promise<void> {
  if (maxLength(text, DAY_NOTE_MAX)) return;
  const stored = await readStored();
  if (stored !== null && text.length <= stored.length) return;
  throw new BadRequestException(
    `text must be shorter than or equal to ${DAY_NOTE_MAX} characters`,
  );
}
