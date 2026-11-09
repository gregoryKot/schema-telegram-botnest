// Сработавший повтор webapp/public/asset-recovery.js (инцидент 2026-11-04, #928):
// файл сборки не дошёл с первого раза, и повтор помог. Без события видна
// только неудача (client_error, секция assets), а сколько выкладок задело
// людей без последствий — нет. Скрипт работает до входа и вне бандла, поэтому
// событие анонимное: POST /api/public-event, userId = null.
//
//   asset_recovered — meta.kind: css (стиль догрузился новым <link>) | js
//                     (входной модуль загрузился после перезагрузки);
//                     meta.attempts — с какой попытки (1..10).
// Литералы в скрипте сверяет asset-recovery.constants.spec.ts (правило №4):
// public/ ничего не импортирует. /stats — строка в блоке «Поломки на клиенте».
export const ASSET_RECOVERY_EVENTS = ['asset_recovered'] as const;

export const ASSET_RECOVERY_KINDS = ['css', 'js'] as const;
export type AssetRecoveryKind = (typeof ASSET_RECOVERY_KINDS)[number];

const KIND_SET: ReadonlySet<string> = new Set(ASSET_RECOVERY_KINDS);
const MAX_ATTEMPTS = 10;

/** Только kind из списка и целое attempts 1..10; иначе null — событие не пишется. */
export function sanitizeAssetRecoveredMeta(
  meta: Record<string, unknown> | undefined,
): { kind: AssetRecoveryKind; attempts: number } | null {
  const kind = meta?.kind;
  const attempts = meta?.attempts;
  if (typeof kind !== 'string' || !KIND_SET.has(kind)) return null;
  if (
    typeof attempts !== 'number' ||
    !Number.isInteger(attempts) ||
    attempts < 1 ||
    attempts > MAX_ATTEMPTS
  ) {
    return null;
  }
  return { kind: kind as AssetRecoveryKind, attempts };
}
