// Формат имени бота Telegram — вынесен из env-registry.ts (правило №10: файл-реестр
// не пухнет вместе со списком форматов).

/** Имя бота без @: 5–32 символа, латиница/цифры/«_» (правила BotFather). */
export function checkTelegramUsername(value: string): string | null {
  return /^[A-Za-z0-9_]{5,32}$/.test(value)
    ? null
    : 'не похоже на имя бота (5–32 символа: латиница, цифры, «_»; без @)';
}
