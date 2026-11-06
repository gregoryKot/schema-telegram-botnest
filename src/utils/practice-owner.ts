// «Владелец практики» — один человек в двух ролях: его Telegram id стоит в
// ADMIN_ID (админские команды, алерты), и его же календарь — это календарь
// записи (AvailabilityRule/Booking без therapistId: календарь в системе один).
// Единственный разбор ADMIN_ID: раньше по копии жило в admin-alert.ts,
// telegram.service.ts и обоих файлах заявки терапевта (src/therapy/).
//
// Аккаунт владельца в приложении — не всегда тот же номер. Для телеграм-входа
// userId РАВЕН telegramId, а после слияния с веб-аккаунтом telegramId живёт
// только в AuthProvider (src/auth/telegram-identity.ts). Поэтому «это аккаунт
// владельца?» спрашивается через practiceOwnerUserId, а не `uid === ADMIN_ID`.
// Без DI: модулем пользуется AlertLogger, созданный раньше контейнера.
import {
  canonicalUserId,
  type AuthProviderReader,
} from '../auth/telegram-identity';

/** Telegram id владельца практики из ADMIN_ID; null — не задан или мусор. */
export function practiceOwnerTelegramId(): number | null {
  const n = Number(process.env.ADMIN_ID);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** userId аккаунта владельца практики (с учётом слияния); null — ADMIN_ID не задан. */
export async function practiceOwnerUserId(
  prisma: AuthProviderReader,
): Promise<bigint | null> {
  const telegramId = practiceOwnerTelegramId();
  if (telegramId === null) return null;
  return canonicalUserId(prisma, telegramId);
}
