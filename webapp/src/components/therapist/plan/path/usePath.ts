import { useEffect, useRef, useState } from 'react';
import { api, reportClientError, type UserId } from '../../../../api';
import type { PathPhasePatch, PathResponse } from '../../../../../../shared/src/therapy/path/pathApi';
import type { PathPhase, PathPhaseDraft, TherapyPath } from '../../../../../../shared/src/therapy/path/pathModel';
import { trackPathCreated, trackPathDatesShifted, trackPathPhaseFinished, trackPathPhaseStarted } from '../../../../../../shared/src/share/pathAnalytics';
import { movePhaseIds } from './pathView';

/**
 * Путь открытого клиента (#1522): загрузка и правки. `path === undefined` — ещё грузится, `null` — пути нет,
 * `failed` — не пришёл (сбой ≠ «пути нет»). Правка по одной, как в usePlanItems: пока запрос в пути (`busy`),
 * второй не уходит; отказ — строкой в `error`. Каждая ручка отвечает путём целиком — он и заменяет текущий.
 */
export function usePath(clientId: UserId) {
  const [path, setPath] = useState<TherapyPath | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const fetchPath = () => {
    api.getTherapyPath(clientId).then(
      (res) => { if (alive.current) setPath(res.path); },
      () => {
        if (!alive.current) return;
        setFailed(true);
        reportClientError({ message: 'therapy path load failed', section: 'therapist.path' });
      },
    );
  };
  useEffect(fetchPath, [clientId]);
  const reload = () => { setFailed(false); setPath(undefined); fetchPath(); };

  async function run(failText: string, work: () => Promise<PathResponse>): Promise<boolean> {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const res = await work();
      if (alive.current) setPath(res.path);
      return true;
    } catch {
      reportClientError({ message: 'therapy path change failed', section: 'therapist.path' });
      if (alive.current) setError(failText);
      return false;
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }

  const patchPhase = (id: number, body: PathPhasePatch, failText = 'Не удалось сохранить фазу') =>
    run(failText, () => api.updatePathPhase(id, body));

  return {
    path, failed, busy, error, reload,
    clearError: () => setError(''),
    create: async (startDate: string, templateId: string | null, phases: PathPhaseDraft[]) => {
      const ok = await run('Не удалось собрать путь', () => api.createTherapyPath(clientId, { startDate, templateId, phases }));
      if (ok) trackPathCreated(api, templateId);
      return ok;
    },
    /** «Начать фазу» / «Завершить фазу» с днём `date`; событие — после ответа сервера. */
    startPhase: async (phase: PathPhase, date: string) => {
      const ok = await patchPhase(phase.id, { startedAt: date }, 'Не удалось начать фазу');
      if (ok) trackPathPhaseStarted(api, phase.templatePhaseId);
      return ok;
    },
    finishPhase: async (phase: PathPhase, date: string) => {
      const ok = await patchPhase(phase.id, { endedAt: date }, 'Не удалось завершить фазу');
      if (ok) trackPathPhaseFinished(api, phase.templatePhaseId);
      return ok;
    },
    patchPhase,
    setStartDate: (startDate: string) => run('Не удалось изменить старт', () => api.setTherapyPathStart(clientId, startDate)),
    /** «Сдвинуть сроки»: у текущей фазы больше недель — плановый конец не раньше сегодня. */
    shiftPhase: async (id: number, weeks: number) => {
      const ok = await patchPhase(id, { weeks }, 'Не удалось сдвинуть сроки');
      if (ok) trackPathDatesShifted(api);
      return ok;
    },
    /** Закрыть фазу `phase` днём `date`, следующую (если есть) начать тем же днём. */
    advance: async (phase: PathPhase, date: string) => {
      const ok = await run('Не удалось перейти к следующей фазе', () => api.advancePathPhase(phase.id, date));
      if (ok) {
        trackPathPhaseFinished(api, phase.templatePhaseId);
        const next = path?.phases.find((p) => p.position > phase.position);
        if (next) trackPathPhaseStarted(api, next.templatePhaseId);
      }
      return ok;
    },
    addPhase: (draft: PathPhaseDraft) => run('Не удалось добавить фазу', () => api.addPathPhase(clientId, draft)),
    removePhase: (id: number) => run('Не удалось удалить фазу', () => api.deletePathPhase(clientId, id)),
    /** Фаза меняется местами с соседом (dir: -1 — выше); сервер получает весь порядок. */
    movePhase: (id: number, dir: -1 | 1) => {
      const next = path ? movePhaseIds(path.phases, id, dir) : null;
      return next ? run('Не удалось переставить фазу', () => api.reorderPathPhases(clientId, next)) : Promise.resolve(false);
    },
  };
}

export type PathState = ReturnType<typeof usePath>;
