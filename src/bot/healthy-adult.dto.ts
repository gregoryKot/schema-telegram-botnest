import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Создание фразы (правило №6: рантайм-валидация через class-validator). */
export class CreatePhraseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text!: string;
}

/** Частичное обновление: текст и/или флаг включённости. */
export class UpdatePhraseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
