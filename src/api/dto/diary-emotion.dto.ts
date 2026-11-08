import { applyDecorators } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// Эмоция записи дневника схем (SchemaDiaryDto.emotions). Без вложенного DTO
// массив принимал любые объекты: ключи и строки любой длины ложились в
// шифрованный JSON записи (аудит 2026-11, S21).
//   id — формат каталога shared/src/schemaTherapy/content/emotions.ts
//        ('fear', 'anxiety', …), тот же, что у id схем: [a-z_]{1,64};
//   intensity — целое. Сайт шлёт 1..5 (INTENSITY_LABELS, по умолчанию 3);
//        верхняя граница 10 — запас под старых клиентов и сид perf-БД
//        (test/perf/seed.ts кладёт 1..10), а не новая шкала.
export const EMOTION_INTENSITY_MAX = 10;
export const EMOTIONS_MAX = 50;

export class EmotionDto {
  @MaxLength(64)
  @Matches(/^[a-z_]{1,64}$/)
  id!: string;

  @IsInt()
  @Min(1)
  @Max(EMOTION_INTENSITY_MAX)
  intensity!: number;
}

/** Массив эмоций: до EMOTIONS_MAX штук, каждая — EmotionDto. */
export const EmotionList = (): PropertyDecorator =>
  applyDecorators(
    IsArray(),
    ArrayMaxSize(EMOTIONS_MAX),
    ValidateNested({ each: true }),
    Type(() => EmotionDto),
  );
