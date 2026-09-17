import { PairsData } from '../../api';

// Карточка активного партнёра (индекс дня, недельные бары, выход из пары).
// Вынесено из PairSheet.tsx (правило №10).
type Partner = PairsData['partners'][number];

function indexColor(v: number): string {
  if (v >= 7) return '#06d6a0';
  if (v >= 4) return 'var(--accent-yellow)';
  return 'var(--accent-red)';
}

export function PartnerCard({
  partner,
  confirmLeaveCode,
  setConfirmLeaveCode,
  onLeave,
}: {
  partner: Partner;
  confirmLeaveCode: string | null;
  setConfirmLeaveCode: (v: string | null) => void;
  onLeave: (code: string) => void;
}) {
  const name = partner.partnerName ?? 'Друг';
  const done = partner.partnerTodayDone && partner.partnerIndex !== null;
  const color = done
    ? indexColor(partner.partnerIndex!)
    : 'rgba(var(--fg-rgb),0.35)';
  const idx = partner.partnerIndex ?? 0;
  const contextMsg = !done
    ? `${name} ещё не заполнил дневник — когда заполнит, день появится здесь`
    : idx < 4
      ? `Сегодня у ${name} непростой день. Иногда просто написать пару слов — уже помогает`
      : idx < 7
        ? `${name} в норме сегодня. Отслеживаете вместе — это уже кое-что`
        : `У ${name} хороший день. Приятно, когда у обоих всё неплохо`;
  return (
    <div
      style={{
        background: 'rgba(var(--fg-rgb),0.04)',
        borderRadius: 'var(--r-16)',
        padding: '14px 16px',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-12)',
          marginBottom: 10,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-sub)',
              marginBottom: 2,
            }}
          >
            {name} сегодня
          </div>
          {done ? (
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color,
                lineHeight: 1,
              }}
            >
              {idx.toFixed(1)}
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 400,
                  color: 'var(--text-sub)',
                }}
              >
                /10
              </span>
            </div>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--text-sub)' }}>
              Ещё не заполнил
            </div>
          )}
        </div>
        {partner.partnerTelegramId && (
          <button
            onClick={() => {
              window.location.href = `tg://user?id=${partner.partnerTelegramId}`;
            }}
            style={{
              padding: '8px 14px',
              border: 'none',
              borderRadius: 'var(--r-10)',
              background:
                'color-mix(in srgb, var(--accent-blue) 15%, transparent)',
              color: 'var(--accent-blue)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Написать
          </button>
        )}
      </div>

      {partner.partnerWeekAvgs?.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-4)',
            alignItems: 'flex-end',
            height: 28,
            marginBottom: 10,
          }}
        >
          {[...partner.partnerWeekAvgs].reverse().map((v, i) => {
            const barH = v !== null ? Math.round((v / 10) * 24) : 3;
            const barColor =
              v === null ? 'rgba(var(--fg-rgb),0.08)' : indexColor(v);
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: barH,
                    borderRadius: 3,
                    background: barColor,
                    transition: 'height 0.3s',
                  }}
                />
                {v !== null && i === partner.partnerWeekAvgs.length - 1 && (
                  <div
                    style={{
                      fontSize: 9,
                      color: 'var(--text-sub)',
                    }}
                  >
                    сег
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div
        style={{
          fontSize: 12,
          color: 'var(--text-sub)',
          lineHeight: 1.5,
          marginBottom: 10,
        }}
      >
        {contextMsg}
      </div>

      {confirmLeaveCode === partner.code ? (
        <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
          <button
            onClick={() => setConfirmLeaveCode(null)}
            style={{
              flex: 1,
              padding: '9px',
              border: 'none',
              borderRadius: 'var(--r-10)',
              background: 'rgba(var(--fg-rgb),0.08)',
              color: 'var(--text-sub)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Отмена
          </button>
          <button
            onClick={() => onLeave(partner.code)}
            style={{
              flex: 1,
              padding: '9px',
              border: 'none',
              borderRadius: 'var(--r-10)',
              background: 'rgba(255,80,80,0.2)',
              color: 'var(--accent-red)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Выйти
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmLeaveCode(partner.code)}
          style={{
            width: '100%',
            padding: '9px',
            border: 'none',
            borderRadius: 'var(--r-10)',
            background: 'rgba(255,80,80,0.08)',
            color: 'rgba(255,100,100,0.6)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Выйти из пары
        </button>
      )}
    </div>
  );
}
