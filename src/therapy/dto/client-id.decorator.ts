import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

/**
 * id клиента терапевта в теле запроса: СТРОКА цифр (аудит 2026-10, X-1).
 * Веб-id в [1e15, 9e15) (ниже 2^53, пин в user-id-range.spec.ts); при
 * расширении JSON-число потеряет точность, поэтому фронт шлёт строку; число из старых клиентов принимается и приводится к строке.
 * Формат тот же, что у parseClientId: минус — только у виртуального клиента
 * (-TherapyRelation.id). Разбор в bigint — в контроллере, parseClientId.
 */
export const ClientIdField = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'number' ? String(value) : value,
    ),
    IsString(),
    Matches(/^-?\d{1,19}$/),
  );
