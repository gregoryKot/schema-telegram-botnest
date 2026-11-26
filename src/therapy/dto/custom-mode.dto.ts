import { IsOptional, IsString, MaxLength } from 'class-validator';
import {
  CUSTOM_MODE_EMOJI_MAX,
  CUSTOM_MODE_NAME_MAX,
} from '../../utils/text-limits';

/**
 * DTO кастомного режима терапевта (аудит 2026-07, 2г / правило №6 CLAUDE.md).
 * `nodeType` — сервис сам подставляет дефолт при неизвестном значении (не
 * отклоняет запрос), поэтому слабая строка, а не `@IsIn(...)`: чтобы не менять
 * «тихий фолбэк» на «400». Длина `name`/`emoji` — 400, а не молчаливая
 * обрезка в сервисе (находка аудита 2026-10-11, backend#29).
 */
export class CustomModeDto {
  @IsOptional()
  @IsString()
  @MaxLength(CUSTOM_MODE_NAME_MAX)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CUSTOM_MODE_EMOJI_MAX)
  emoji?: string;

  @IsOptional()
  @IsString()
  nodeType?: string;
}
