import { useEffect, useState } from 'react';
import { api } from '../api';
import { todayStr } from '../utils/format';
import {
  buildMapInput,
  buildNextStepInput,
} from '../../../shared/src/map/mapInputs';
import type { MapInput } from '../../../shared/src/map/mapVm';
import type { NextStepInput } from '../../../shared/src/case/caseNextStep';
import { collectWarmWords } from '../../../shared/src/warmWords/collectWarmWords';

/**
 * Данные карты себя: разборы (записи дневника режимов) и карточки режимов.
 * Отдельного хранилища у разбора нет — он сохраняется обычной записью, и
 * карта строится из неё. Twin schema-miniapp/src/hooks/useSelfMapData.ts
 * (правило №3) — отличается только транспорт (webapp api вместо миниапповского).
 */
export function useSelfMapData(refreshKey = 0): {
  map: MapInput | null;
  next: NextStepInput | null;
} {
  const [map, setMap] = useState<MapInput | null>(null);
  const [next, setNext] = useState<NextStepInput | null>(null);

  useEffect(() => {
    let ignore = false;
    Promise.all([api.getModeDiary(), api.getModeNotes(), api.getProfile()])
      .then(([cases, notes, profile]) => {
        if (ignore) return;
        const today = todayStr();
        const ysqDone = !!profile.ysq?.completedAt;
        const warm = collectWarmWords(notes, cases);
        setMap(
          buildMapInput(
            cases,
            notes,
            ysqDone,
            warm.map((w) => w.text),
            today,
          ),
        );
        setNext(buildNextStepInput(cases, notes, ysqDone, today));
      })
      .catch((e) => console.error('self map load failed', e));
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  return { map, next };
}
