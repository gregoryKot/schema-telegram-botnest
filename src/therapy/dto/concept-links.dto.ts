import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  CONCEPT_MODE_ALIAS_MAX,
  CONCEPT_MODE_TEXT_MAX,
  CONCEPT_SCHEMA_TEXT_MAX,
} from '../../utils/text-limits';

// Вложенные DTO связей графической концептуализации вынесены из
// conceptualization.dto.ts (правило №10: файл не растёт вместе со списком).
// Вложенный объект: без @ValidateNested + @Type в родителе whitelist его не
// тронул бы — лишние поля внутри связи прошли бы насквозь.

/**
 * Связи одного режима в графической концептуализации (контракт —
 * `ConceptModeLink` в shared/src/apiTypes.ts). Свободный текст (alias,
 * origin, manifest, strategy) — клиническая запись терапевта, шифруется
 * вместе со всем массивом в `therapy-notes.service.ts`.
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
 * Тексты одной схемы в графической концептуализации (контракт —
 * `ConceptSchemaLink` в shared/src/apiTypes.ts): убеждение клиента и
 * детский опыт, из которого схема выросла, плюс блокируемые потребности.
 * Свободный текст (belief, origin) — клиническая запись терапевта, шифруется
 * вместе со всем массивом в `therapy-notes.service.ts`.
 */
export class ConceptSchemaLinkDto {
  @IsString()
  @MaxLength(64)
  schemaId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(CONCEPT_SCHEMA_TEXT_MAX)
  belief?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CONCEPT_SCHEMA_TEXT_MAX)
  origin?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  needIds?: string[];
}
