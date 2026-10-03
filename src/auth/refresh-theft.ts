// Вынесено из auth.service.ts — тот файл стоит на потолке размера (правило
// №10 CLAUDE.md), новая логика едет сюда, а не туда.
//
// Разбор 31.08.2026, продолжение 2026-09-03 («владелец получал DM
// refresh_token_reuse десятки раз с одной family»). Вердикт «кража» не был
// идемпотентен: revokeFamilyExcept отзывает ВСЮ family сразу, и любое
// следующее предъявление ЛЮБОГО токена этой же семьи снова доходит до
// theft-ветки (наследник отозван / истёк — classifyReuse, refresh-rotation.ts)
// → снова revokeFamilyExcept (no-op, отзывать уже нечего) → снова DM. Мёртвая
// кука в телефоне живёт до 30 дней и стреляет алертом при каждом открытии
// приложения. Первое срабатывание — событие, все остальные — эхо, которое
// его заглушает и жрёт общий бюджет алерта (3 за 15 минут на имя события,
// см. security-log.service.ts/AlertBudget).
//
// Отличить событие от эха можно по `count` из updateMany: если family уже
// была вся отозвана, повторный вызов отзывает 0 строк.
import type { PrismaService } from '../prisma/prisma.service';

/**
 * true — это первая кража: revokeFamilyExcept реально отозвал хотя бы одну
 * живую строку, стоит будить админа. false — семья уже была мертва: это эхо
 * той же мёртвой куки, отзывать нечего, алерт был бы шумом, а не сигналом.
 */
export function shouldAlertTheft(revokedCount: number): boolean {
  return revokedCount > 0;
}

export interface TheftAlertDeps {
  prisma: PrismaService;
  /** DM админу (SecurityLogService.log('refresh_token_reuse', ...)). */
  onAlert: (userId: bigint, family: string) => void;
  /** Стабильный текст без чисел в начале строки — чтобы AlertLogger не
   * заводил новый ключ на каждый повтор. Всегда `logger.warn`, никогда DM. */
  onEcho: (message: string) => void;
}

const DEAD_FAMILY_ECHO =
  'Refresh token reuse on an already-revoked family — echo of a dead cookie, not a new theft';

/**
 * Отзывает всю family (кроме exceptHash) и решает, будить ли админа — общая
 * точка идемпотентности вердикта «кража» для
 * auth.service.ts::rotateRefreshToken.
 */
export async function revokeFamilyAndAlert(
  deps: TheftAlertDeps,
  family: string,
  userId: bigint,
  exceptHash: string | null = null,
): Promise<void> {
  const { count } = await deps.prisma.webSession.updateMany({
    where: {
      family,
      revokedAt: null,
      ...(exceptHash ? { tokenHash: { not: exceptHash } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  if (shouldAlertTheft(count)) {
    deps.onAlert(userId, family);
  } else {
    deps.onEcho(DEAD_FAMILY_ECHO);
  }
}
