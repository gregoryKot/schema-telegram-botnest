import { PartnerInfo } from '../api';

interface Props {
  partners: PartnerInfo[];
  pendingCode: string | null;
  showInvite: boolean;
  onOpen: () => void;
  onDismissInvite: () => void;
}

function indexColor(v: number): string {
  if (v >= 7) return '#06d6a0';
  if (v >= 4) return 'var(--accent-yellow)';
  return 'var(--accent-red)';
}

export function PairCard({ partners, pendingCode, showInvite, onOpen, onDismissInvite }: Props) {
  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 14,
    padding: '12px 16px', marginBottom: 8,
    border: '1px solid rgba(var(--fg-rgb),0.07)',
  };

  return (
    <>
      {partners.map(partner => {
        const name = partner.partnerName ?? 'Друг';
        const done = partner.partnerTodayDone && partner.partnerIndex !== null;
        const color = done ? indexColor(partner.partnerIndex ?? 0) : 'rgba(var(--fg-rgb),0.3)';
        return (
          <div key={partner.code} style={{ ...rowStyle, cursor: 'pointer' }} onClick={onOpen}>
            <span style={{ fontSize: 22 }}>🤝</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>{name} сегодня</div>
              {done ? (
                <div style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1.2 }}>
                  {(partner.partnerIndex ?? 0).toFixed(1)}
                  <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-sub)' }}>/10</span>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>ещё не заполнил</div>
              )}
            </div>
            <span style={{ fontSize: 16, color: 'var(--text-faint)' }}>›</span>
          </div>
        );
      })}

      {pendingCode && (
        <div style={{ ...rowStyle, cursor: 'pointer' }} onClick={onOpen}>
          <span style={{ fontSize: 22 }}>⏳</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', fontWeight: 500 }}>Ждём партнёра</div>
            <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 1 }}>Ссылка отправлена — напомнить?</div>
          </div>
          <span style={{ fontSize: 16, color: 'var(--text-faint)' }}>›</span>
        </div>
      )}

      {showInvite && (
        <div style={rowStyle}>
          <span style={{ fontSize: 22 }}>🤝</span>
          <div style={{ flex: 1, cursor: 'pointer' }} onClick={onOpen}>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', fontWeight: 500 }}>Отслеживать вместе</div>
            <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 1 }}>Пригласи друга или партнёра</div>
          </div>
          <span onClick={onOpen} style={{ fontSize: 16, color: 'var(--text-faint)', cursor: 'pointer' }}>›</span>
          <button
            onClick={e => { e.stopPropagation(); onDismissInvite(); }}
            style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 18, cursor: 'pointer', padding: '0 0 0 4px', lineHeight: 1 }}
          >×</button>
        </div>
      )}

      {partners.length > 0 && !pendingCode && (
        <div
          onClick={onOpen}
          style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', padding: '2px 0 8px', cursor: 'pointer' }}
        >
          + Пригласить ещё
        </div>
      )}
    </>
  );
}
