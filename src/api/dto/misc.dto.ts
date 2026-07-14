import {
  Allow,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * DTO для мелких эндпоинтов api.controller.ts (аудит 2026-07, 2г / правило
 * №6 CLAUDE.md). `data` — произвольный JSON черновика, помечен @Allow()
 * (passthrough), формат `startedAt` проверяется вручную в контроллере.
 */
export class SaveDraftDto {
  @IsString()
  startedAt!: string;

  @Allow()
  data: unknown;
}

export class UpdateNameDto {
  @IsString()
  @MaxLength(50)
  name!: string;
}

export class InitDto {
  @IsOptional()
  @IsString()
  timezone?: string;
}

/** Общая форма для чекинов (план дня, задача терапевта) — одно поле done. */
export class CheckinDto {
  @IsBoolean()
  done!: boolean;
}
