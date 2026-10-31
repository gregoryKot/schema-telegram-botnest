import { useCallback, useState } from 'react';
import { api, reportClientError, type UserId } from '../../api';
import { buildConceptGraph } from '../../../../shared/src/therapy/conceptGraph/conceptGraphModel';
import type { ConceptGraphSource } from '../../../../shared/src/therapy/conceptGraph/conceptGraphTypes';
import { pickForm, useAddressForm } from '../../utils/addressForm';
import { conceptToModeMap } from '../modeMap/conceptToModeMap';

/** «Схема случая · 15 окт.» — день создания в часовом поясе терапевта: он сам видит, когда это было. */
export const canvasMapTitle = (at: Date = new Date()) =>
  `Схема случая · ${at.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;

/**
 * Каждое «Открыть на холсте» — новый снимок схемы (с несохранёнными правками),
 * поэтому вторая карта за день получает номер: «… · 27 окт. (2)». Раньше все
 * снимки дня звались одинаково, и в ряду карт их было не различить (QA 2026-10-26).
 */
export function distinctTitle(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}

async function takenTitles(clientId: UserId): Promise<string[]> {
  try { return (await api.listModeMaps(clientId)).map(m => m.title); } catch { return []; } // не узнали — имя без номера, карта всё равно откроется
}

/**
 * «Открыть на холсте»: схема случая, которую видит терапевт, становится новой
 * картой режимов, где фигуры можно двигать, дописывать и соединять. Граф
 * строится из того же `source`, что и сама схема (с несохранёнными правками), а
 * не из того, что лежит на сервере.
 */
export function useOpenConceptCanvas({ clientId, source, onOpened }: {
  clientId: UserId | null | undefined;
  source: ConceptGraphSource;
  onOpened: (mapId: number) => void;
}) {
  const form = useAddressForm();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const open = useCallback(async () => {
    if (clientId == null) return;
    setBusy(true);
    setFailed(false);
    let created: number | null = null;
    try {
      const graph = buildConceptGraph(source, (ty, vy) => pickForm(form, ty, vy));
      const { nodes, edges } = conceptToModeMap(graph);
      created = (await api.createModeMap(clientId, distinctTitle(canvasMapTitle(), await takenTitles(clientId)), 'personality')).id;
      await api.updateModeMap(created, { nodes, edges });
      api.trackEvent('concept_canvas_open');
      onOpened(created);
    } catch (e) {
      setFailed(true);
      const reason = e instanceof Error ? e.message : 'unknown';
      reportClientError({ message: `concept canvas open failed: ${reason}`, section: 'therapist.conceptCanvas' });
      // Пустая карта без фигур не нужна: повторная попытка создала бы вторую рядом.
      if (created !== null) {
        api.deleteModeMap(created).catch(() =>
          reportClientError({ message: 'concept canvas cleanup failed', section: 'therapist.conceptCanvas' }));
      }
    } finally {
      setBusy(false);
    }
  }, [clientId, source, form, onOpened]);

  return { busy, failed, open };
}
