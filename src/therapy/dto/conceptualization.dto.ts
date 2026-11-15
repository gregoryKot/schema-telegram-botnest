// @Type() (ниже) читает design-time метаданные через Reflect — полифилл
// нужен явно: в юнит-тесте DTO грузится без бутстрапа Nest.
import 'reflect-metadata';
import {
  ArrayMaxSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ConceptModeLinkDto, ConceptSchemaLinkDto } from './concept-links.dto';
import { StringsWithin } from './strings-within';
import {
  CONCEPT_FIELD_TEXT_MAX as TEXT_MAX,
  CONCEPT_SCHEMA_IDS_MAX,
  MODE_MAP_NODE_TEXT_MAX,
} from '../../utils/text-limits';

// Потолки связей и режимов концептуализации — одно число на полное тело, патч
// (concept-save.dto.ts, concept-save.ts) и дописывание с холста, правило №4.
export const CONCEPT_MODE_LINKS_MAX = 40;
export const CONCEPT_SCHEMA_LINKS_MAX = 20;
export const CONCEPT_MODE_IDS_MAX = 100;

/**
 * DTO для карты концептуализации терапевта (аудит 2026-07, 2г / правило
 * №6 CLAUDE.md). Лимиты (текст — `CONCEPT_FIELD_TEXT_MAX`, его же `maxLength`
 * у полей обоих фронтов; 64 символа на id, 200/500
 * узлов/рёбер карты режимов) уже проверялись вручную — продублированы.
 * `modeMapNodes`/`modeMapEdges` — узлы и связи старого холста (сайт их больше
 * не шлёт): элемент — объект, строки в нём — в границах карты режимов
 * (mode-maps.dto.ts); вложенный DTO с whitelist срезал бы поля узла.
 */
export class ConceptualizationDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(CONCEPT_SCHEMA_IDS_MAX) // его же держит дописывание с холста
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  schemaIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(CONCEPT_MODE_IDS_MAX) // режимы модели и свои; его же держит дописывание с холста
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
  @IsObject({ each: true })
  @StringsWithin(MODE_MAP_NODE_TEXT_MAX)
  modeMapNodes?: object[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsObject({ each: true })
  @StringsWithin(MODE_MAP_NODE_TEXT_MAX)
  modeMapEdges?: object[];

  /** Связи режимов графической концептуализации (не больше 40 режимов). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(CONCEPT_MODE_LINKS_MAX)
  @ValidateNested({ each: true })
  @Type(() => ConceptModeLinkDto)
  modeLinks?: ConceptModeLinkDto[];

  /** Тексты схем графической концептуализации (схем в форме Янга 18, запас до 20). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(CONCEPT_SCHEMA_LINKS_MAX)
  @ValidateNested({ each: true })
  @Type(() => ConceptSchemaLinkDto)
  schemaLinks?: ConceptSchemaLinkDto[];
}
