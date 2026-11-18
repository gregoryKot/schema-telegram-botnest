import { useEffect, useState } from 'react';
import { api, reportClientError } from '../../api';
import { describeFailure } from '../../../../shared/src/api/describeFailure';
import type { SessionWorkItem } from '../../../../shared/src/therapy/sessionWork/types';
import { customModeId, isCustomModeId } from '../modeMap/useCustomModes';

export interface NamedMode { id: string; name: string }

/** Есть ли в пунктах свой режим терапевта — тогда подписи без загрузки своих режимов не собрать. */
export const hasCustomMode = (work: readonly SessionWorkItem[] | undefined): boolean =>
  (work ?? []).some((item) => item.modeIds.some(isCustomModeId));

/**
 * Свои режимы терапевта для «Что делали»: выбор «С чем работали» и подписи под
 * записью и в журнале. Грузятся, когда понадобились (`needed`: открыт пункт
 * формы или в записях есть свой режим). Не загрузились — пусто и отчёт наверх,
 * выбор идёт по справочнику; удалённый свой режим подписи не даёт.
 */
export function useCustomModeNames(needed: boolean): NamedMode[] {
  const [modes, setModes] = useState<NamedMode[]>([]);
  useEffect(() => {
    if (!needed) return;
    let live = true;
    api.listCustomModes().then(
      (list) => { if (live) setModes(list.map((m) => ({ id: customModeId(m), name: m.name }))); },
      (e: unknown) => reportClientError({ message: `session work custom modes load failed: ${describeFailure(e)}`, section: 'therapist.clientDetail' }),
    );
    return () => { live = false; };
  }, [needed]);
  return modes;
}
