// @Type() (ниже) читает design-time метаданные через Reflect — полифилл
// нужен явно: в юнит-тесте DTO грузится без бутстрапа Nest.
import 'reflect-metadata';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CONCEPT_MODE_ALIAS_MAX,
  CONCEPT_MODE_TEXT_MAX,
} from '../../utils/text-limits';

const TEXT_MAX = 5000;

/**
 * Связи одного режима в графической концептуализации (контракт —
 * `ConceptModeLink` в shared/src/apiTypes.ts). Свободный текст (alias,
 * origin, manifest, strategy) — клиническая запись терапевта, шифруется
 * вместе со всем массивом в `therapy-notes.service.ts`. Вложенный объект:
 * без @ValidateNested + @Type whitelist его не тронул бы (лишние поля
 * внутри связи прошли бы насквозь).
 */
export class ConceptModeLinkDto {
  @IsString()
  @MaxLength(64)
  modeId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(CONCEPT_MODE_ALIAS_MAX)
  alias?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  schemaIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  needIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(CONCEPT_MODE_TEXT_MAX)
  origin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CONCEPT_MODE_TEXT_MAX)
  manifest?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CONCEPT_MODE_TEXT_MAX)
  strategy?: string;
}

/**
 * DTO для карты концептуализации терапевта (аудит 2026-07, 2г / правило
 * №6 CLAUDE.md). Лимиты (5000 символов текста, 64 символа на id, 200/500
 * узлов/рёбер карты режимов) уже проверялись вручную — продублированы.
 * `modeMapNodes`/`modeMapEdges` — произвольная структура графа, форма
 * элементов не валидировалась и раньше — оставляем как есть.
 */
export class ConceptualizationDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  schemaIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  modeIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX)
  earlyExperience?: string;

  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX)
  unmetNeeds?: string;

  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX)
  triggers?: string;

  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX)
  copingStyles?: string;

  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX)
  goals?: string;

  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX)
  currentProblems?: string;

  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX)
  modeTransitions?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  modeMapNodes?: unknown[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  modeMapEdges?: unknown[];

  /** Связи режимов графической концептуализации (не больше 40 режимов). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ConceptModeLinkDto)
  modeLinks?: ConceptModeLinkDto[];
}
