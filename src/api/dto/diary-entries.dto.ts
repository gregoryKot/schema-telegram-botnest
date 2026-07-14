import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * DTO для дневников (схема/режим/благодарность) в diary.controller.ts —
 * аудит 2026-07, 2г / правило №6 CLAUDE.md. Свободный текст обрезается
 * контроллером до 2000/500 символов без отказа — здесь щедрый потолок
 * 10000 против abuse (правило CLAUDE.md про свободный текст), сама
 * обрезка в контроллере не убрана. `emotions` — массив {id, intensity},
 * контроллер сам не проверяет форму элементов — оставляем как есть,
 * только ограничение количества.
 */
const FREE_TEXT_MAX = 10000;

export class SchemaDiaryDto {
  @IsString()
  trigger!: string;

  @IsArray()
  @ArrayMaxSize(50)
  emotions!: { id: string; intensity: number }[];

  @IsOptional()
  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  thoughts?: string;

  @IsOptional()
  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  bodyFeelings?: string;

  @IsOptional()
  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  actualBehavior?: string;

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  schemaIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  schemaOrigin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  healthyView?: string;

  @IsOptional()
  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  realProblems?: string;

  @IsOptional()
  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  excessiveReactions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  healthyBehavior?: string;
}

export class ModeDiaryDto {
  @IsString()
  modeId!: string;

  @IsString()
  situation!: string;

  @IsOptional()
  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  thoughts?: string;

  @IsOptional()
  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  feelings?: string;

  @IsOptional()
  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  bodyFeelings?: string;

  @IsOptional()
  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  actions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  actualNeed?: string;

  @IsOptional()
  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  childhoodMemories?: string;
}

export class GratitudeDiaryDto {
  @IsString()
  date!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(FREE_TEXT_MAX, { each: true })
  items!: string[];
}
