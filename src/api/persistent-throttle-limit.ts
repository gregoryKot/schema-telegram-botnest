import { applyDecorators } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PersistentThrottle } from './persistent-throttle.decorator';

type Limits = Parameters<typeof Throttle>[0];

/**
 * `@Throttle(limits)` + `@PersistentThrottle()` одной строкой: ручка с кодом
 * или заявкой, счётчик которой живёт в Postgres и переживает деплой
 * (правило №5). Одна строка на хендлере вместо пяти: контроллеры упёрлись в
 * потолок размера файла (правило №10). Гейт check-persistent-throttle.mjs
 * узнаёт её так же, как пару декораторов.
 */
export const PersistentThrottleLimit = (limits: Limits) =>
  applyDecorators(Throttle(limits), PersistentThrottle());
