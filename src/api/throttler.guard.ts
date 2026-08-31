import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { resolveTracker, type TrackerRequest } from './throttler-identity';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: TrackerRequest): Promise<string> {
    return Promise.resolve(
      resolveTracker(req, {
        // JWT_SECRET — как есть: access-токены подписаны сырым значением
        // (auth.service getOrThrow), проверять надо тем же. BOT_TOKEN —
        // .trim(): initData Telegram подписывает НАСТОЯЩИМ токеном бота, а
        // auth.service его тоже тримит; пробел/перенос в env иначе ронял бы
        // сверку и ронял ВСЕХ мини-апп-юзеров в общий IP-бакет (разбор 2026-08-31).
        jwtSecret: process.env.JWT_SECRET,
        botToken: process.env.BOT_TOKEN?.trim(),
      }),
    );
  }
}
