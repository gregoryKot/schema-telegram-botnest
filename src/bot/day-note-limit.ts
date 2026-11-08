import { BadRequestException } from '@nestjs/common';
import { maxLength } from 'class-validator';
import { DAY_NOTE_MAX } from '../utils/text-limits';

// Заметка дня длиннее DAY_NOTE_MAX бывает только после слияния аккаунтов:
// joinDayNotes (src/auth/merge-combine-rules.ts) склеивает заметки одного дня
// через пустую строку и не режет — обрезка потеряла бы текст человека (#1022).
// Правило: текст в пределе проходит всегда; длиннее предела — только если он
// не длиннее уже сохранённого (правка без роста: исправить, сократить). Новая
// заметка и дописывание держат предел, как раньше.

/**
 * Потолок DTO — защитный, не предел заметки: его решает сервис по сохранённому
 * тексту. Слияний в один день бывает несколько (n полных заметок — n·500 +
 * (n−1)·2), и прежний потолок «две заметки» (1002) отвечал 400 на правку третьей
 * склейки (хвост волны 2). 4000 — семь полных заметок; тело всё равно ограничено.
 */
export const DAY_NOTE_MERGED_MAX = 4000;

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
