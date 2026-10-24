import { PairsData } from '../../api';
import { TONE_COLOR, WeekBars } from './WeekBars';
import { useTr } from '../../utils/addressForm';
import {
  indexTone,
  partnerContextText,
  PARTNER_EMPTY_TEXT,
} from '../../../../shared/src/pair/partnerCard';

// Карточка активного партнёра (индекс дня, недельные бары, выход из пары).
// Вынесено из PairSheet.tsx (правило №10).
type Partner = PairsData['partners'][number];

export function PartnerCard({
  partner,
  confirmLeaveCode,
  setConfirmLeaveCode,
  onLeave,
  leaveError,
}: {
  partner: Partner;
  leaveError?: boolean;
  confirmLeaveCode: string | null;
  setConfirmLeaveCode: (v: string | null) => void;
  onLeave: (code: string) => void;
}) {
  const tr = useTr();
  const name = partner.partnerName ?? 'Друг';
  const done = partner.partnerTodayDone && partner.partnerIndex !== null;
  const idx = partner.partnerIndex ?? 0;
  const color = done ? TONE_COLOR[indexTone(idx)] : 'rgba(var(--fg-rgb),0.35)';
  const contextMsg = partnerContextText(name, !!done, idx);
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
        <div className="u-flex1">
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
              {PARTNER_EMPTY_TEXT}
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

      <WeekBars avgs={partner.partnerWeekAvgs} />

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

      {leaveError && (
        <div
          style={{ fontSize: 12, color: 'var(--accent-red)', marginBottom: 8 }}
        >
          {tr(
            'Не удалось выйти из пары. Попробуй ещё раз',
            'Не удалось выйти из пары. Попробуйте ещё раз',
          )}
        </div>
      )}

      {confirmLeaveCode === partner.code ? (
        <div className="u-row8">
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
              background:
                'color-mix(in srgb, var(--accent-red) 20%, transparent)',
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
            background: 'color-mix(in srgb, var(--accent-red) 8%, transparent)',
            color: 'color-mix(in srgb, var(--accent-red) 60%, transparent)',
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
