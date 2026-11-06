import { useEffect, useState } from 'react';
import { api, type ModeMapFull, type ModeMapKind, type ModeMapMeta, type UserId } from '../../api';
import { conceptGraphSource, type ConceptGraphFields } from '../../../../shared/src/therapy/conceptGraph/conceptGraphSource';
import type { ConceptGraphSource } from '../../../../shared/src/therapy/conceptGraph/conceptGraphTypes';
import { useAddressForm } from '../../utils/addressForm';
import { createConceptMap } from './createConceptMap';
import { newMapTitle } from './mapKinds';

/** Из чего собрать карту «Концептуализация»: поля ещё грузятся, собирать не из чего — или источник графа. */
export type ConceptSource = 'loading' | 'empty' | ConceptGraphSource;

/** Без режимов и схем карта вышла бы кругом потребностей без единой фигуры клиента — такой тип недоступен. */
export function conceptSourceOf(c: ConceptGraphFields | null | undefined): Exclude<ConceptSource, 'loading'> {
  const source = conceptGraphSource(c ?? {});
  return source.modeIds.length > 0 || source.schemaIds.length > 0 ? source : 'empty';
}

/** Концептуализация с сервера: тип «Концептуализация» собирается из сохранённых полей. */
function useConceptSource(clientId: UserId): ConceptSource {
  const [state, setState] = useState<{ id: UserId; value: ConceptSource }>({ id: clientId, value: 'loading' });
  useEffect(() => {
    let alive = true;
    api.getConceptualization(clientId)
      .then(c => { if (alive) setState({ id: clientId, value: conceptSourceOf(c) }); })
      .catch(() => { if (alive) setState({ id: clientId, value: 'empty' }); }); // не загрузилась — собрать не из чего
    return () => { alive = false; };
  }, [clientId]);
  return state.id === clientId ? state.value : 'loading';
}

/**
 * Создание карты по типу из «Новая карта» и экрана «нет карт» (#963):
 * «Концептуализация» собирается из полей (`createConceptMap`), остальные типы —
 * пустая карта со своим заголовком. Отказ не молчит: `failed` видит терапевт.
 */
export function useNewMap(clientId: UserId, maps: ModeMapMeta[], onCreated: (m: ModeMapFull) => void) {
  const form = useAddressForm();
  const concept = useConceptSource(clientId);
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState(false);

  async function create(kind: ModeMapKind) {
    if (kind === 'concept' && typeof concept === 'string') return; // кнопка недоступна; страховка от гонки
    setCreating(true);
    setFailed(false);
    try {
      const m = kind === 'concept' && typeof concept !== 'string'
        ? await createConceptMap({ clientId, source: concept, form, taken: maps.map(x => x.title) })
        : await api.createModeMap(clientId, newMapTitle(kind, maps), kind);
      onCreated(m);
    } catch {
      setFailed(true);
    } finally {
      setCreating(false);
    }
  }

  return { create, creating, failed, concept: typeof concept === 'string' ? concept : 'ready' as const };
}
