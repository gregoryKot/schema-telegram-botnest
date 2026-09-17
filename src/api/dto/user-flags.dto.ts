import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * DTO для POST /api/user-flags, за TelegramAuthGuard (правило №6). Раньше
 * тело было `Record<string, unknown>` — контроллер фильтровал ключи по
 * FLAG_FIELDS перед записью в Prisma, но значения не проверялись по типу
 * (можно было записать объект/массив вместо boolean).
 *
 * `therapistMode` НАМЕРЕННО отсутствует — whitelist его срежет. Это
 * привилегия, выставляется сервером из role (см. FLAG_FIELDS в
 * api.controller.ts), клиент не может её выставить.
 *
 * @IsOptional() пропускает и `null` — это по делу: nullable-строки
 * (themePref, lastCelebrationDate и т.п.) сбрасываются в null («тема
 * системная», «баннер не показан» и т.д.).
 *
 * Набор полей обязан совпадать с FLAG_FIELDS контроллера — сверка типов
 * там же (правило №4, денормализация только с проверкой-сверкой).
 *
 * `declare` на каждом поле — не косметика: контроллер решает, что писать в
 * Prisma, циклом `for (k of FLAG_FIELDS) if (k in body) …` — а tsconfig
 * этого проекта таргетит ES2023, где class-поле без `declare` компилируется
 * в реальное присвоение `this.field = undefined` в конструкторе (нативная
 * семантика class fields, не квирк TS). Без `declare` `plainToInstance`
 * материализует ВСЕ 15 полей как собственные свойства инстанса ещё до того,
 * как в них что-то запишут из payload — `k in body` стало бы true всегда,
 * даже для непосланных полей, и цикл контроллера перестал бы отличать
 * «не прислали» от «прислали как undefined». `declare` говорит TS не
 * генерировать это присвоение: собственным свойством поле станет, только
 * если class-transformer реально скопирует его из payload.
 */
export class UserFlagsDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  declare themePref?: string | null;

  @IsOptional()
  @IsBoolean()
  declare onboardingV1Done?: boolean;

  @IsOptional()
  @IsBoolean()
  declare onboardingV2Done?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  @ArrayMaxSize(200)
  declare onboardingSkipped?: string[];

  @IsOptional()
  @IsBoolean()
  declare childhoodWheelDone?: boolean;

  @IsOptional()
  @IsBoolean()
  declare ysqBannerDismissed?: boolean;

  @IsOptional()
  @IsBoolean()
  declare hintSheetCloseShown?: boolean;

  @IsOptional()
  @IsBoolean()
  declare hintHistoryDismissed?: boolean;

  @IsOptional()
  @IsBoolean()
  declare trackerOnboardingDone?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  declare lastCelebrationDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  declare lastYesterdayBannerDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  declare lastWeeklyQuestionWeek?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  @ArrayMaxSize(200)
  declare schemaIntrosShown?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  @ArrayMaxSize(200)
  declare modeIntrosShown?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(32)
  declare defaultSection?: string | null;
}
