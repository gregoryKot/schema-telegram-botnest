import { TherapyClientSummary } from '../../api';
import { isActiveToday } from '../../../../shared/src/therapy/clientSheetHelpers';

// Три стат-карточки над списком клиентов (клиентов / активных / оценили).
// Вынесено из ClientListView (правило №10 — файл-храповик). «Активных» —
// по календарю каждого клиента (isActiveToday), не по дню терапевта.
export function StatCards({ clients }: { clients: TherapyClientSummary[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 'var(--space-10)',
        marginBottom: 20,
      }}
    >
      {[
        { value: clients.length, label: 'КЛИЕНТОВ' },
        {
          value: clients.filter(isActiveToday).length,
          label: 'АКТИВНЫХ',
        },
        {
          value: clients.filter((c) => c.todayIndex !== null).length,
          label: 'ОЦЕНИЛИ',
        },
      ].map(({ value, label }) => (
        <div
          key={label}
          className="card"
          style={{
            borderRadius: 'var(--r-16)',
            padding: '14px 12px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: 'var(--text)',
              lineHeight: 1,
              letterSpacing: '-0.5px',
            }}
          >
            {value}
          </div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: 'var(--text-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginTop: 4,
            }}
          >
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}
