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
import { ConceptModeLinkDto, ConceptSchemaLinkDto } from './concept-links.dto';
import { CONCEPT_FIELD_TEXT_MAX as TEXT_MAX } from '../../utils/text-limits';

/**
 * DTO для карты концептуализации терапевта (аудит 2026-07, 2г / правило
 * №6 CLAUDE.md). Лимиты (текст — `CONCEPT_FIELD_TEXT_MAX`, его же `maxLength`
 * у полей обоих фронтов; 64 символа на id, 200/500
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

  /** Тексты схем графической концептуализации (схем в форме Янга 18, запас до 20). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ConceptSchemaLinkDto)
  schemaLinks?: ConceptSchemaLinkDto[];
}
