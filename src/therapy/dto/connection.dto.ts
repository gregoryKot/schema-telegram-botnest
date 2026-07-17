import { IsBoolean, IsInt, IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO подключения клиент↔терапевт (аудит 2026-07, 2г / правило №6
 * CLAUDE.md). Формат кода приглашения не проверяется отдельно —
 * сервис сам отвергает неизвестный/просроченный код.
 */
export class JoinTherapyDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class VirtualClientDto {
  @IsString()
  name!: string;
}

// Эндпоинт всегда возвращает 403 (см. therapy-connection.controller.ts) — DTO нужен
// только для рантайм-типизации тела запроса, ручной ветки добавления
// реальных клиентов больше нет.
export class AddClientDto {
  @IsInt()
  clientTelegramId!: number;
}

// Запоминаемое предпочтение терапевта: стартовать в кабинете (on=true) или в
// клиентском режиме (on=false). Правило №6 CLAUDE.md — рантайм-валидация тела.
export class TherapistViewDto {
  @IsBoolean()
  on!: boolean;
}
