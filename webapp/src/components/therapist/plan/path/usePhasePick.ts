import { useEffect, useMemo, useState } from 'react';
import { api, type UserId } from '../../../../api';
import type { TherapyPath } from '../../../../../../shared/src/therapy/path/pathModel';
import { buildPathTemplates } from '../../../../../../shared/src/therapy/path/templates';
import { useTr } from '../../../../utils/addressForm';
import { suggestPhaseId } from './pathView';

/**
 * Выбор фазы для «В план»: путь единственного выбранного клиента грузится тихо (без пути или при сбое
 * поля выбора нет), предвыбрана типичная фаза адреса; руками выбранное не перетирается.
 */
export function usePhasePick(clientId: string | null, sourceAddress: string) {
  const tr = useTr();
  const [loaded, setLoaded] = useState<{ clientId: string; path: TherapyPath } | null>(null);
  const [chosen, setChosen] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    setLoaded(null);
    setChosen(undefined);
    if (clientId == null) return;
    let alive = true;
    api.getTherapyPath(clientId as UserId).then(
      (res) => { if (alive && res.path) setLoaded({ clientId, path: res.path }); },
      () => {},
    );
    return () => { alive = false; };
  }, [clientId]);
  const path = loaded && loaded.clientId === clientId ? loaded.path : null;
  const templates = useMemo(() => buildPathTemplates(tr), [tr]);
  const suggested = useMemo(
    () => (path ? suggestPhaseId(path, templates.find((t) => t.id === path.templateId) ?? null, sourceAddress) : null),
    [path, templates, sourceAddress],
  );
  const phases = path ? [...path.phases].sort((a, b) => a.position - b.position) : [];
  return { phases, phaseId: path ? (chosen === undefined ? suggested : chosen) : null, setPhaseId: setChosen };
}
