// Greeting header (date, name) + streak badge for the Today screen.

import { UserProfile } from '../../types';
import { formatGreetingDate } from './helpers';

export function TodayHeader({
  firstName,
  profile,
  streak,
}: {
  firstName: string;
  profile: UserProfile | null;
  streak: number;
}) {
  return (
    <div style={{ padding: '24px 20px 0' }}>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-faint)',
          fontWeight: 500,
          marginBottom: 5,
          letterSpacing: '0.03em',
        }}
      >
        {formatGreetingDate()}
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-faint)',
          fontWeight: 500,
          marginBottom: 2,
        }}
      >
        {firstName ? 'Привет,' : ''}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: 'var(--text)',
            letterSpacing: '-0.5px',
            lineHeight: 1.2,
          }}
        >
          {firstName ?? 'Добро пожаловать'}
        </div>
        {/* Streak */}
        {profile !== null && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              flexShrink: 0,
              background:
                streak > 0 ? 'rgba(251,146,60,0.12)' : 'var(--surface)',
              border: `1px solid ${streak > 0 ? 'rgba(251,146,60,0.22)' : 'var(--border-color)'}`,
              borderRadius: 20,
              padding: '5px 10px',
            }}
          >
            {streak > 7 ? (
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="#fb923c"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 2C12 2 9 7 9 10.5C9 12.43 10.57 14 12.5 14C14.43 14 16 12.43 16 10.5C16 9.5 15.5 8.5 15 7.5C15 7.5 17 9 17 12C17 15.31 14.31 18 11 18C7.69 18 5 15.31 5 12C5 7 12 2 12 2Z" />
              </svg>
            ) : (
              <span style={{ fontSize: 13 }}>{streak > 0 ? '✨' : '💤'}</span>
            )}
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: streak > 0 ? '#fb923c' : 'var(--text-faint)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {streak}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
