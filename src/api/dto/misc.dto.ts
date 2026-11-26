import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { TIMEZONE_MAX_LENGTH } from '../../notification/notify-timezones';

/** DTO для мелких эндпоинтов api.controller.ts (аудит 2026-07, 2г / правило №6). */
export class UpdateNameDto {
  @IsString()
  @MaxLength(50)
  name!: string;
}

export class InitDto {
  // Пояс устройства (Intl). Неизвестный пояс не сохраняется
  // (AccountService.registerUser → isNotifyTimezone).
  @IsOptional()
  @IsString()
  @MaxLength(TIMEZONE_MAX_LENGTH)
  timezone?: string;
}

/** Общая форма для чекинов (план дня, задача терапевта) — одно поле done. */
export class CheckinDto {
  @IsBoolean()
  done!: boolean;
}
