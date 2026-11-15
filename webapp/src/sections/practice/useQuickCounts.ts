// Мета квадратов «Здесь и сейчас» — только из реальных данных: сколько раз пройдены заземление и
// «Стоп» (getPracticeSessions) и сколько сохранено карточек «Мне плохо» (getFlashcardsCount: число без
// самих карточек, только если квадрат на экране). undefined — ещё грузится (плашка-скелетон), null — не
// пришло (квадрат без меты, без выдуманного нуля).
import { useEffect, useState } from 'react';
import { api } from '../../api';

export type QuickCount = number | null | undefined;
export interface QuickCounts { grounding: QuickCount; stop: QuickCount; sos: QuickCount }

type Sessions = Awaited<ReturnType<typeof api.getPracticeSessions>>;

export function useQuickCounts(withSos: boolean): QuickCounts {
  const [sessions, setSessions] = useState<Sessions | null | undefined>(undefined);
  const [sos, setSos] = useState<QuickCount>(undefined);

  useEffect(() => {
    let ignore = false;
    api.getPracticeSessions()
      .then((c) => { if (!ignore) setSessions(c); })
      .catch((e) => { console.error('getPracticeSessions failed', e); if (!ignore) setSessions(null); });
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    if (!withSos) return;
    let ignore = false;
    api.getFlashcardsCount()
      .then(({ count }) => { if (!ignore) setSos(count); })
      .catch((e) => { console.error('getFlashcardsCount failed', e); if (!ignore) setSos(null); });
    return () => { ignore = true; };
  }, [withSos]);

  const session = (id: 'grounding' | 'stop'): QuickCount =>
    sessions === undefined ? undefined : (sessions?.[id] ?? null);
  return { grounding: session('grounding'), stop: session('stop'), sos: withSos ? sos : null };
}
