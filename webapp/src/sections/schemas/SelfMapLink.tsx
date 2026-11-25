// Мост «Мои паттерны» → «Карта себя» во вкладке «Режимы»: те же режимы, разложенные по разборам на сцене.
// Карта открывается тем же хостом, что из «Ещё» (CaseFlowHost, start="map").
import { useState } from 'react';
import { api } from '../../api';
import { CaseFlowHost } from '../../components/caseFlow/CaseFlowHost';

type Props = Pick<React.ComponentProps<typeof CaseFlowHost>, 'onOpenTracker' | 'onOpenSchema'>;

export function SelfMapLink({ onOpenTracker, onOpenSchema }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="ds-link cs-selfmap-link" onClick={() => { void api.trackEvent('self_map_link', { to: 'map' }); setOpen(true); }}>
        Где это на карте себя →
      </button>
      {open && <CaseFlowHost start="map" onClose={() => setOpen(false)} onOpenTracker={onOpenTracker} onOpenSchema={onOpenSchema} />}
    </>
  );
}
