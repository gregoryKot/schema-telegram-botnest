import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { ExId, ExStats } from './exerciseLibrary';

type Stats = Partial<Record<ExId, ExStats>>;

/** Сколько раз и когда пройдено каждое упражнение — из реальных записей. */
export function useExerciseStats(): Stats {
  const [stats, setStats] = useState<Stats>({});
  useEffect(() => {
    Promise.allSettled([
      api.getBeliefChecks(), api.getSchemaNotes(), api.getModeNotes(),
      api.getLetters(), api.getSafePlace(), api.getChildhoodRatings(), api.getPhraseChecks(),
    ]).then(([beliefs, schemas, modes, letters, safe, wheel, phrases]) => {
      const upd: Stats = {};
      if (beliefs.status === 'fulfilled') { const b = beliefs.value; if (b.length) upd.belief = { count: b.length, lastDone: b[0]?.createdAt ?? null }; }
      if (schemas.status === 'fulfilled') { const s = schemas.value; if (s.length) { const sr = [...s].sort((a, b) => b.updatedAt > a.updatedAt ? 1 : -1); upd.schema = { count: s.length, lastDone: sr[0]?.updatedAt ?? null }; } }
      if (modes.status === 'fulfilled')   { const m = modes.value;   if (m.length) { const mr = [...m].sort((a, b) => b.updatedAt > a.updatedAt ? 1 : -1); upd.mode   = { count: m.length, lastDone: mr[0]?.updatedAt ?? null }; } }
      if (letters.status === 'fulfilled') { const l = letters.value; if (l.length) upd.letter = { count: l.length, lastDone: l[0]?.createdAt ?? null }; }
      if (safe.status === 'fulfilled' && safe.value) upd.safe = { count: 1, lastDone: safe.value.updatedAt ?? null };
      if (wheel.status === 'fulfilled' && Object.keys(wheel.value as object).length > 0) upd.wheel = { count: 1, lastDone: null };
      if (phrases.status === 'fulfilled') { const p = phrases.value; if (p.length) upd.phrase = { count: p.length, lastDone: p[0]?.createdAt ?? null }; }
      setStats(upd);
    });
  }, []);
  return stats;
}
