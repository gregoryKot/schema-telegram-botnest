import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PHRASE_MARK_IDS } from '../../bot/phrase-check.constants';

const TEXT_MAX = 3000;

/**
 * Разбор фразы внутреннего голоса (правило №6: рантайм-валидация декораторами,
 * а не inline-интерфейсом). marks — только известные id примет: список из
 * четырёх штук, всё остальное отбивается ValidationPipe до сервиса.
 */
export class PhraseCheckDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(TEXT_MAX)
  phrase!: string;

  @IsArray()
  @ArrayMaxSize(PHRASE_MARK_IDS.length)
  @IsIn(PHRASE_MARK_IDS, { each: true })
  marks!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX)
  rewrite?: string;

  /** Забрать переписанную фразу в «Тёплые слова» — выбор пользователя. */
  @IsOptional()
  @IsBoolean()
  inWarmWords?: boolean;
}

/**
 * Правка уже сохранённого разбора: меняется ТОЛЬКО ответ Здорового Взрослого.
 * Сама фраза и приметы критика — факт момента, они не редактируются задним
 * числом. Пустая строка — валидна: это осознанная очистка ответа, сервис
 * превращает её в null (см. createPhraseCheck).
 */
export class UpdatePhraseCheckDto {
  @IsString()
  @MaxLength(TEXT_MAX)
  rewrite!: string;
}
