import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { DIARY_FIELD_MAX } from '../../utils/text-limits';

/**
 * DTO дневников схем и режимов в diary.controller.ts (благодарность —
 * `gratitude-diary.dto.ts`) — аудит 2026-07, 2г / правило №6 CLAUDE.md. Лимит свободного текста один,
 * здесь: превышение — 400, а не обрезка в контроллере (backend#29).
 * `emotions` — массив {id, intensity}, контроллер форму элементов не
 * проверяет — оставляем как есть, только ограничение количества.
 */
export class SchemaDiaryDto {
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  trigger!: string;

  @IsArray()
  @ArrayMaxSize(50)
  emotions!: { id: string; intensity: number }[];

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  thoughts?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  bodyFeelings?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  actualBehavior?: string;

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  schemaIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  schemaOrigin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  healthyView?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  realProblems?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  excessiveReactions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  healthyBehavior?: string;
}

export class ModeDiaryDto {
  @IsString()
  modeId!: string;

  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  situation!: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  thoughts?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  feelings?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  bodyFeelings?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  actions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  actualNeed?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  childhoodMemories?: string;

  // Что бы сказал Здоровый Взрослый — свободный текст, пишет клиент сам.
  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  healthyResponse?: string;

  // Запись родилась из потока «Что случилось» (сайт): по ней «Записи» строят
  // фильтр «Случаи», а /stats — счётчик разборов. Без поля — обычная запись.
  @IsOptional()
  @IsBoolean()
  fromCase?: boolean;
}
