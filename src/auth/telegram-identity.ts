// Соответствие «аккаунт ↔ адрес в Telegram». Ровно одно место, где живёт
// ответ на вопрос «кому из наших принадлежит этот telegramId» и обратный
// «куда писать этому аккаунту».
//
// Зачем понадобилось. Исторически userId для телеграм-входа РАВЕН telegramId
// (auth.service.ts, findOrCreateUserByProvider), и код разошёлся по этому
// допущению: планировщик подставлял userId прямо в sendMessage как чат-адрес,
// а бот при /start заводил строку User с id = telegramId. Допущение верно
// только для телеграм-провайдера: у входа через Google, почту и MAX userId
// лежит в веб-диапазоне, а после слияния аккаунтов строка User источника
// физически удаляется (merge.service.ts) — telegramId остаётся жить только в
// AuthProvider. С этого момента оба направления обязаны спрашивать AuthProvider,
// а не считать одно число двумя разными вещами.
//
// Функции, а не сервис: тем же соответствием пользуются и внутри транзакции
// удаления аккаунта, и в батче рассылки, и в хендлерах бота — инжектить туда
// ещё один провайдер незачем, достаточно передать клиента Prisma (подойдёт и
// `tx` внутри $transaction).

const TELEGRAM = 'telegram';

/** Минимум от Prisma, который нужен этому модулю (PrismaService или tx). */
export interface AuthProviderReader {
  authProvider: {
    findUnique(args: {
      where: { provider_providerId: { provider: string; providerId: string } };
      select: { userId: true };
    }): Promise<{ userId: bigint } | null>;
    findFirst(args: {
      where: { userId: bigint; provider: string };
      select: { providerId: true };
      orderBy: { id: 'desc' };
    }): Promise<{ providerId: string } | null>;
    findMany(args: {
      where: { provider: string; userId: { in: bigint[] } };
      select: { userId: true; providerId: true };
      orderBy: { id: 'asc' };
    }): Promise<Array<{ userId: bigint; providerId: string }>>;
  };
}

/** Строка providerId — всегда десятичное число, но пришла она из БД. */
function toId(providerId: string): bigint | null {
  try {
    return BigInt(providerId);
  } catch {
    return null;
  }
}

/**
 * Чей это аккаунт. Возвращает userId владельца telegram-провайдера, а если
 * привязки нет — сам telegramId: так выглядит и человек, который пришёл в бота
 * впервые, и старый пользователь бота, которому AuthProvider никогда не
 * заводили. Оба случая законно живут под userId = telegramId, и запись по
 * этому id создаст (или найдёт) правильную строку.
 *
 * Важно, что фолбэк НЕ означает «аккаунта нет»: он означает «аккаунт, если он
 * есть, лежит под этим же номером». Единственная ситуация, где так делать
 * нельзя, — слитый аккаунт, и её как раз закрывает поиск по AuthProvider.
 */
export async function canonicalUserId(
  prisma: AuthProviderReader,
  telegramId: number | bigint,
): Promise<bigint> {
  const providerId = String(telegramId);
  const row = await prisma.authProvider.findUnique({
    where: { provider_providerId: { provider: TELEGRAM, providerId } },
    select: { userId: true },
  });
  return row ? row.userId : BigInt(telegramId);
}

/**
 * Куда писать этому аккаунту. `null` — писать некуда: у человека нет
 * телеграм-входа вовсе (зашёл через Google, почту или MAX). Это НЕ «он
 * заблокировал бота», и путать эти два исхода нельзя — второй выключает
 * человеку уведомления навсегда.
 */
export async function telegramIdFor(
  prisma: AuthProviderReader,
  userId: bigint,
): Promise<bigint | null> {
  const row = await prisma.authProvider.findFirst({
    where: { userId, provider: TELEGRAM },
    select: { providerId: true },
    orderBy: { id: 'desc' },
  });
  return row ? toId(row.providerId) : null;
}

/**
 * То же для пачки аккаунтов — одним запросом. Очередь уведомлений и рассылка
 * ходят сотнями строк за тик, и поштучный поиск превратил бы это в N+1.
 *
 * Ключ — строка userId (BigInt как ключ Map сравнивается по ссылке).
 * Аккаунты без телеграм-входа в карте просто отсутствуют.
 */
export async function telegramIdsFor(
  prisma: AuthProviderReader,
  userIds: bigint[],
): Promise<Map<string, bigint>> {
  const uniq = [...new Set(userIds.map(String))].map((s) => BigInt(s));
  if (uniq.length === 0) return new Map();
  const rows = await prisma.authProvider.findMany({
    where: { provider: TELEGRAM, userId: { in: uniq } },
    select: { userId: true, providerId: true },
    orderBy: { id: 'asc' },
  });
  const out = new Map<string, bigint>();
  for (const r of rows) {
    const id = toId(r.providerId);
    // Последняя строка по id выигрывает — детерминированно на случай, когда у
    // аккаунта оказалось два телеграм-провайдера (слияние двух телеграмов).
    if (id !== null) out.set(r.userId.toString(), id);
  }
  return out;
}
