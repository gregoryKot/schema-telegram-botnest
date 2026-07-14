import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { NEED_IDS } from '../../bot/bot.service';

const TEXT_MAX = 3000;

/**
 * DTO для инструментов дневника (belief-checks, letters, safe-place,
 * flashcards) — аудит 2026-07, 2г / правило №6 CLAUDE.md. Лимиты
 * дублируют уже существующие ручные проверки в контроллере.
 */
export class BeliefCheckDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(TEXT_MAX)
  belief!: string;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(TEXT_MAX, { each: true })
  evidenceFor!: string[];

  @IsArray()
  @IsString({ each: true })
  @MaxLength(TEXT_MAX, { each: true })
  evidenceAgainst!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX)
  reframe?: string;
}

export class LetterDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  text?: string;
}

export class SafePlaceDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
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
  @MaxLength(TEXT_MAX)
  reflection?: string;

  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX)
  action?: string;
}
