import { IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * DTO подключения клиент↔терапевт (аудит 2026-07, 2г / правило №6
 * CLAUDE.md). Формат кода приглашения не проверяется отдельно —
 * сервис сам отвергает неизвестный/просроченный код.
 */
export class JoinTherapyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code!: string;
}

export class VirtualClientDto {
  @IsString()
  name!: string;
}

// Запоминаемое предпочтение терапевта: стартовать в кабинете (on=true) или в
// клиентском режиме (on=false). Правило №6 CLAUDE.md — рантайм-валидация тела.
export class TherapistViewDto {
  @IsBoolean()
  on!: boolean;
}
