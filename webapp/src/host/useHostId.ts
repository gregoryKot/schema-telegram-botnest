import { useEffect, useState } from 'react';
import { getHost, type HostId } from '../../../shared/src/host';
import { LATE_HOST_READS_MS } from './initHost';

/** Площадка, в которой открыт сайт. Пересчитывается, если SDK мессенджера доехал позже. */
export function useHostId(): HostId {
  const [id, setId] = useState<HostId>(() => getHost().id);
  useEffect(() => {
    const timers = LATE_HOST_READS_MS.map((ms) =>
      setTimeout(() => setId(getHost().id), ms),
    );
    return () => timers.forEach(clearTimeout);
  }, []);
  return id;
}
