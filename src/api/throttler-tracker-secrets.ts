import type { TrackerSecrets } from './throttler-identity';

// Вынесено из throttler.guard.ts (правило №10: файл упёрся в потолок
// файл-храповика — раздутый файл дробится, а не растёт дальше).
//
// JWT_SECRET — как есть: access-токены подписаны сырым значением
// (auth.service getOrThrow), проверять надо тем же. BOT_TOKEN — .trim():
// initData Telegram подписывает НАСТОЯЩИМ токеном бота, а auth.service его
// тоже тримит; пробел/перенос в env иначе ронял бы сверку и ронял ВСЕХ
// мини-апп-юзеров в общий IP-бакет (разбор 2026-08-31).
export function trackerSecrets(): TrackerSecrets {
  return {
    jwtSecret: process.env.JWT_SECRET,
    botToken: process.env.BOT_TOKEN?.trim(),
  };
}
