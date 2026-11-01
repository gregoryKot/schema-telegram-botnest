import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { DIARY_FIELD_MAX } from '../../utils/text-limits';

/** Тело `POST /api/diary/gratitude` (правило №6; лимит текста — как у дневников). */
export class GratitudeDiaryDto {
  @IsString()
  date!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(DIARY_FIELD_MAX, { each: true })
  items!: string[];

  /**
   * Пункты дня, какими клиент их видел до правки. Есть — сервер сливает
   * `items` с днём в БД и не теряет пункт, добавленный с другой вкладки
   * (`src/bot/gratitude-merge.ts`); нет — прежняя замена целиком.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(DIARY_FIELD_MAX, { each: true })
  base?: string[];
}
