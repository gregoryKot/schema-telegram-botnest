import { TherapyClientSummary } from '../../api';

// Три стат-карточки над списком клиентов (клиентов / активных / оценили).
// Вынесено из ClientListView (правило №10 — файл-храповик).
export function StatCards({
  clients,
  today,
}: {
  clients: TherapyClientSummary[];
  today: string;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 10,
        marginBottom: 20,
      }}
    >
      {[
        { value: clients.length, label: 'КЛИЕНТОВ' },
        {
          value: clients.filter((c) => c.lastActiveDate === today).length,
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
            borderRadius: 16,
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
