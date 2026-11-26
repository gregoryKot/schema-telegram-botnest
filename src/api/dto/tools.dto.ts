import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { NEED_IDS } from '../../bot/bot.service';
import {
  EXERCISE_TEXT_MAX,
  LETTER_TEXT_MAX,
  SAFE_PLACE_TEXT_MAX,
} from '../../utils/text-limits';

/**
 * DTO для инструментов дневника (belief-checks, letters, safe-place,
 * flashcards) — аудит 2026-07, 2г / правило №6 CLAUDE.md. Пределы — из
 * `src/utils/text-limits.ts`: поля упражнений на сайте берут те же числа
 * (`maxLength` + счётчик), иначе длинный текст упирался в 400, а экран
 * говорил «проверь соединение».
 */
export class BeliefCheckDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(EXERCISE_TEXT_MAX)
  belief!: string;

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(EXERCISE_TEXT_MAX, { each: true })
  evidenceFor!: string[];

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(EXERCISE_TEXT_MAX, { each: true })
  evidenceAgainst!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(EXERCISE_TEXT_MAX)
  reframe?: string;
}

export class LetterDto {
  @IsOptional()
  @IsString()
  @MaxLength(LETTER_TEXT_MAX)
  text?: string;
}

export class SafePlaceDto {
  @IsOptional()
  @IsString()
  @MaxLength(SAFE_PLACE_TEXT_MAX)
  description?: string;
}

// Флэшкарта привязана к needId, либо к спец-режимам detached/critic (не
// входят в основной список потребностей).
const FLASHCARD_NEED_IDS = [...NEED_IDS, 'detached', 'critic'];

export class FlashcardDto {
  @IsOptional()
  @IsString()
  modeId?: string;

  @IsOptional()
  @IsIn(FLASHCARD_NEED_IDS)
  needId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(EXERCISE_TEXT_MAX)
  reflection?: string;

  @IsOptional()
  @IsString()
  @MaxLength(EXERCISE_TEXT_MAX)
  action?: string;
}
