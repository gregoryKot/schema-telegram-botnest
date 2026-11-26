import { PUBLIC_CRISIS_SURFACES } from '../analytics/public-crisis.constants';

/**
 * meta анонимного crisis_card_shown / crisis_hotline_tapped: только surface из
 * PUBLIC_CRISIS_SURFACES (форма записи на визитке). Любой другой экран —
 * авторизованный, его принимает POST /api/event; аноним не должен писать в
 * его счётчики. Невалидное — null: контроллер молча дропает (не оракул).
 */
export function sanitizePublicCrisisMeta(
  meta: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  const surface = meta?.surface;
  return typeof surface === 'string' && PUBLIC_CRISIS_SURFACES.includes(surface)
    ? { surface }
    : null;
}
