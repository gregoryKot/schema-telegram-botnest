import {
  SIGNUP_SOURCES,
  type SignupSource,
} from '../analytics/signup-sources.constants';

const SIGNUP_SOURCE_SET = new Set<string>(SIGNUP_SOURCES);

// Разбор /start-payload с посевной ссылки `t.me/<bot>?start=src_<slug>`
// (атрибуция платных посевов в Telegram-каналах). Чистая функция — вынесена
// из telegram.service.ts (правило №10: худший файл репозитория, храповик не
// даёт ему расти).
//
// Неизвестный/мусорный slug нормализуется в 'other' (правило №7 CLAUDE.md:
// свободный текст пользователя в meta аналитики недопустим) — событие
// signup_source пишется всегда с одним из SIGNUP_SOURCES, никогда с сырой
// строкой из ссылки. Возвращает null, если payload вообще не в этом формате
// (пусто, другой префикс вроде `pair_`) — тогда событие не пишется вовсе.
export function parseSourceSlug(
  payload: string | undefined,
): SignupSource | null {
  if (!payload || !payload.startsWith('src_')) return null;
  const slug = payload.slice(4).trim().toLowerCase();
  return (SIGNUP_SOURCE_SET.has(slug) ? slug : 'other') as SignupSource;
}
