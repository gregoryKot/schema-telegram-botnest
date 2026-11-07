import { useCallback, useState } from 'react';
import { api, type UserId } from '../../api';
import type { ConceptGraphSource } from '../../../../shared/src/therapy/conceptGraph/conceptGraphTypes';
import { useAddressForm } from '../../utils/addressForm';
import { createConceptMap } from '../modeMap/createConceptMap';

async function takenTitles(clientId: UserId): Promise<string[]> {
  try { return (await api.listModeMaps(clientId)).map(m => m.title); } catch { return []; } // не узнали — имя без номера, карта всё равно откроется
}

/**
 * «Открыть на холсте»: схема случая, которую видит терапевт, становится новой
 * картой «Концептуализация» на вкладке «Графические карты», где фигуры можно
 * двигать, дописывать и соединять. Граф строится из того же `source`, что и
 * сама схема (с несохранёнными правками), а не из того, что лежит на сервере.
 * Сборка — общая с типом «Концептуализация» в «Новая карта» (`createConceptMap`).
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
    try {
      const map = await createConceptMap({ clientId, source, form, taken: await takenTitles(clientId) });
      onOpened(map.id);
    } catch {
      setFailed(true); // телеметрию и уборку пустой карты сделал createConceptMap
    } finally {
      setBusy(false);
    }
  }, [clientId, source, form, onOpened]);

  return { busy, failed, open };
}
