// @Type() (ниже) читает design-time метаданные через Reflect — полифилл
// нужен явно: в юнит-тесте DTO грузится без бутстрапа Nest.
import 'reflect-metadata';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NEED_IDS } from '../../bot/bot.service';
import { MODE_MAP_NODE_TEXT_MAX } from '../../utils/text-limits';
import { NEED_RATING_MAX } from '../concept-need-links';

// Тело «сохранить колесо потребностей» (POST /api/therapy/conceptualization/
// :clientId/needs, правило №6). Контракт — ConceptNeedLink в
// shared/src/therapy/conceptGraph/needLinks.ts (сверка — concept-needs.dto.spec.ts).
// Колесо приходит целиком: до пяти записей, по одной на потребность из NEED_IDS
// (= NEED_ORDER сайта). Вложенные объекты — с @ValidateNested + @Type: иначе
// whitelist не тронул бы лишние поля внутри записи.

/** Заметка периода — предел текста узла карты: поле стоит в панели холста, а заметки карт #1065 переезжают сюда как есть. */
export const CONCEPT_NEED_NOTE_MAX = MODE_MAP_NODE_TEXT_MAX;

/** Оценки потребности по периодам: целые 0–10; периода нет — не оценено. */
export class ConceptNeedRatingsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(NEED_RATING_MAX)
  child?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(NEED_RATING_MAX)
  teen?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(NEED_RATING_MAX)
  now?: number;
}

/** Заметки по периодам — свободный текст терапевта (шифруется, concept-needs.ts). */
export class ConceptNeedNotesDto {
  @IsOptional()
  @IsString()
  @MaxLength(CONCEPT_NEED_NOTE_MAX)
  child?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CONCEPT_NEED_NOTE_MAX)
  teen?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CONCEPT_NEED_NOTE_MAX)
  now?: string;
}

export class ConceptNeedLinkDto {
  @IsIn(NEED_IDS)
  needId!: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ConceptNeedRatingsDto)
  ratings?: ConceptNeedRatingsDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ConceptNeedNotesDto)
  notes?: ConceptNeedNotesDto;
}

export class ConceptNeedsDto {
  @IsArray()
  @ArrayMaxSize(NEED_IDS.length)
  @ValidateNested({ each: true })
  @Type(() => ConceptNeedLinkDto)
  needLinks!: ConceptNeedLinkDto[];
}
