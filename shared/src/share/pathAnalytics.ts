// Аналитика пути клиента и отметок плана в итогах сессии (кабинет терапевта, правило №8).
// Парный allow-list и смысл полей — src/analytics/path-events.constants.ts. В событие идут только id шаблона,
// ключ фазы шаблона ('custom' — своя фаза) и числа: названия, тексты, клиент и пункты — нет (правило №7).
// Имя в trackEvent — строковым литералом: так его видит трипваер analytics-sync.

interface PathTracker {
  trackEvent(name: string, meta?: Record<string, unknown>): void;
}

/** Путь собран; templateId null — пустой путь. */
export function trackPathCreated(
  api: PathTracker,
  templateId: string | null,
): void {
  api.trackEvent('therapy_path_created', { template: templateId ?? 'empty' });
}

export function trackPathPhaseStarted(
  api: PathTracker,
  templatePhaseId: string | null,
): void {
  api.trackEvent('therapy_path_phase_started', {
    phase: templatePhaseId ?? 'custom',
  });
}

export function trackPathPhaseFinished(
  api: PathTracker,
  templatePhaseId: string | null,
): void {
  api.trackEvent('therapy_path_phase_finished', {
    phase: templatePhaseId ?? 'custom',
  });
}

/** «Сдвинуть сроки» у фазы, что идёт дольше плана. */
export function trackPathDatesShifted(api: PathTracker): void {
  api.trackEvent('therapy_path_dates_shifted');
}

/** Из листа черновика собран путь; picked — сколько пунктов выбрано. */
export function trackPathDraftBuilt(api: PathTracker, picked: number): void {
  api.trackEvent('therapy_path_draft_built', { picked });
}

/** В итогах сессии сохранены отметки пунктов плана; 0 не шлётся. */
export function trackPlanSessionMarked(api: PathTracker, items: number): void {
  if (items > 0) api.trackEvent('therapy_plan_session_marked', { items });
}

/** Обёртка сохранения заметки: после успеха шлёт число отмеченных пунктов плана (аргумент planItemIds). */
export function withPlanMarkTracking<A extends unknown[], R>(
  api: PathTracker,
  create: (...args: [...A, number[]]) => Promise<R>,
): (...args: [...A, number[]]) => Promise<R> {
  return (...args) =>
    create(...args).then((note) => {
      trackPlanSessionMarked(api, (args[args.length - 1] as number[]).length);
      return note;
    });
}
