import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const TEXT_MAX = 5000;

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
}
