import type { TherapyClientSummary } from '../../api';
import type { AddClientState } from './types';
import { ClientListHeader } from './ClientListHeader';
import { AddClientPanel } from './AddClientPanel';
import { ClientListRows } from './ClientListRows';

interface Props {
  safeTop: number;
  animKey: number;
  onClose: () => void;
  loading: boolean;
  clients: TherapyClientSummary[];
  today: string;
  tr: (ty: string, vy: string) => string;
  openClient: (c: TherapyClientSummary) => void;
  addClient: AddClientState;
}

export function ClientListView({
  safeTop,
  animKey,
  onClose,
  loading,
  clients,
  today,
  tr,
  openClient,
  addClient,
}: Props) {
  const { addMode, openAddMode } = addClient;

  const slideStyle: React.CSSProperties = {
    animation: 'fade-in 0.22s ease',
  };

  return (
    <div style={{ padding: `${safeTop + 20}px 20px 100px` }}>
      <div key={`list-${animKey}`} style={slideStyle}>
        <ClientListHeader
          onClose={onClose}
          addMode={addMode}
          openAddMode={openAddMode}
          loading={loading}
          clients={clients}
          today={today}
        />
        <AddClientPanel addClient={addClient} />
        <ClientListRows
          loading={loading}
          clients={clients}
          today={today}
          tr={tr}
          openClient={openClient}
          openAddMode={openAddMode}
        />
      </div>
    </div>
  );
}
