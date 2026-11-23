import { api } from '../../../../api';
import type { PathPhasePatch } from '../../../../../../shared/src/therapy/path/pathApi';
import type { PathPhase, PathPhaseDraft, TherapyPath } from '../../../../../../shared/src/therapy/path/pathModel';
import { trackPathCreated, trackPathDatesShifted, trackPathPhaseFinished, trackPathPhaseStarted } from '../../../../../../shared/src/share/pathAnalytics';

interface PathCore {
  path: TherapyPath | null | undefined;
  create: (startDate: string, templateId: string | null, phases: PathPhaseDraft[]) => Promise<boolean>;
  patchPhase: (id: number, body: PathPhasePatch, failText?: string) => Promise<boolean>;
  shiftPhase: (id: number, weeks: number) => Promise<boolean>;
  advance: (id: number, date: string) => Promise<boolean>;
}

/** Событие — только после успешного ответа сервера. */
const done = (p: Promise<boolean>, track: () => void) => p.then((ok) => { if (ok) track(); return ok; });

/** Правки пути с событиями аналитики (№8): действия над фазой принимают фазу целиком — нужен её ключ шаблона. */
export function withPathEvents<C extends PathCore>(core: C) {
  return {
    ...(core as Omit<C, 'advance'>),
    create: (startDate: string, templateId: string | null, phases: PathPhaseDraft[]) =>
      done(core.create(startDate, templateId, phases), () => trackPathCreated(api, templateId)),
    startPhase: (phase: PathPhase, date: string) =>
      done(core.patchPhase(phase.id, { startedAt: date }, 'Не удалось начать фазу'), () => trackPathPhaseStarted(api, phase.templatePhaseId)),
    finishPhase: (phase: PathPhase, date: string) =>
      done(core.patchPhase(phase.id, { endedAt: date }, 'Не удалось завершить фазу'), () => trackPathPhaseFinished(api, phase.templatePhaseId)),
    shiftPhase: (id: number, weeks: number) => done(core.shiftPhase(id, weeks), () => trackPathDatesShifted(api)),
    /** Закрыть фазу `phase` днём `date`, следующую (если есть) начать тем же днём. */
    advance: (phase: PathPhase, date: string) =>
      done(core.advance(phase.id, date), () => {
        trackPathPhaseFinished(api, phase.templatePhaseId);
        const next = core.path?.phases.find((p) => p.position > phase.position);
        if (next) trackPathPhaseStarted(api, next.templatePhaseId);
      }),
  };
}
