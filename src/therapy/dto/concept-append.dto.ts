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
  ConceptAppendLinkDto,
  ConceptAppendSchemaLinkDto,
} from './concept-append-links.dto';

// Тело «дописать в концептуализацию с холста» (POST
// /api/therapy/conceptualization/:clientId/append, #963). Контракт —
// ConceptAppendBody в shared/src/therapy/conceptAppend.ts (сверка —
// concept-append.dto.spec.ts). Только id: свободного текста холст в поля не
// пишет. Лимиты — как у ConceptualizationDto: 64 символа на id, связь режима
// несёт до 20 схем, режимов на карте не больше 40. Линии — concept-append-links.dto.ts.

export class ConceptAppendDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  modeIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  schemaIds?: string[];

  // Вложенный объект: без @ValidateNested + @Type whitelist не тронул бы
  // лишние поля внутри связи (alias, тексты) — они прошли бы насквозь.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ConceptAppendLinkDto)
  modeLinks?: ConceptAppendLinkDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ConceptAppendSchemaLinkDto)
  schemaLinks?: ConceptAppendSchemaLinkDto[];
}
