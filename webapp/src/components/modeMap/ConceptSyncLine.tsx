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
 * Строка связи холста с концептуализацией (#963) — левая часть полосы статуса над холстом (.mm2-statusbar):
 * одна линия с многоточием; все имена — в title и по тапу на текст. Пока концептуализация грузится — скелетон.
 */
export function ConceptSyncLine({ onAddToMap }: Props) {
  const sync = useConceptSyncState();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false);
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
      if (await onAddToMap()) api.trackEvent('concept_sync_to_map'); // литерал; константа сверяется в ConceptSyncLine.test
    } finally {
      setAdding(false);
    }
  };
  const isErr = view.state === 'error' || view.state === 'failed';
  return (
    <div className={`mm2-sync${isErr ? ' is-err' : ''}${open ? ' is-open' : ''}`} {...(isErr ? { role: 'alert' } : { role: 'status', 'aria-live': 'polite' as const })}>
      {view.full ? <button type="button" className="mm2-sync-text" title={view.full} aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? view.full : view.text}</button>
        : <span className="mm2-sync-text">{view.text}</span>}
      {view.action === 'retry' && (
        <button type="button" className="mm2-sync-btn" onClick={sync.retry}>Повторить</button>
      )}
      {view.action === 'add' && (
        <button type="button" className="mm2-sync-btn" disabled={adding} onClick={() => void addToMap()}>Добавить на карту</button>
      )}
    </div>
  );
}
