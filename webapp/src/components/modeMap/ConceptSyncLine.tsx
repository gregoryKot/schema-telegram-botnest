import { useState } from 'react';
import { api } from '../../api';
import { Skeleton } from '../Skeleton';
import { useConceptSyncState } from './conceptSyncContext';
import { syncLineView } from './conceptSyncText';

interface Props {
  /** Тот же путь, что пункт меню «Из концептуализации клиента»: дописывает недостающее, расставленное не двигает. */
  onAddToMap: () => Promise<boolean>;
}

/**
 * Строка связи холста с концептуализацией (#963) над холстом, рядом со
 * статусом сохранения. Видна всегда, пока открыта карта клиента: что ушло в
 * поля, что в полях есть, а на карте нет, или что всё совпадает. Пока
 * концептуализация грузится — скелетон строки, «Добавить на карту» недоступна.
 */
export function ConceptSyncLine({ onAddToMap }: Props) {
  const sync = useConceptSyncState();
  const [adding, setAdding] = useState(false);
  if (!sync) return null;
  const view = syncLineView(sync);
  if (view.state === 'off') return null;
  if (view.state === 'loading') {
    return <div className="mm2-sync" aria-busy="true"><Skeleton width={260} height={12} radius={6} /></div>;
  }

  const addToMap = async () => {
    setAdding(true);
    sync.markToMap();
    try {
      if (await onAddToMap()) api.trackEvent('concept_sync_to_map');
    } finally {
      setAdding(false);
    }
  };
  const isErr = view.state === 'error' || view.state === 'failed';
  return (
    <div className={`mm2-sync${isErr ? ' is-err' : ''}`} {...(isErr ? { role: 'alert' } : { role: 'status', 'aria-live': 'polite' as const })}>
      <span>{view.text}</span>
      {view.action === 'retry' && (
        <button type="button" className="mm2-sync-btn" onClick={sync.retry}>Повторить</button>
      )}
      {view.action === 'add' && (
        <button type="button" className="mm2-sync-btn" disabled={adding} onClick={() => void addToMap()}>Добавить на карту</button>
      )}
    </div>
  );
}
