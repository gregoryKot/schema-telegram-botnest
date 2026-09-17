import { pressable } from '../../utils/a11y';

// Общий подэкран «ввести код приглашения» механики «пара» (правило №11
// CLAUDE.md) — раньше был написан дважды (PairSheet.tsx, PartnerSection.tsx)
// с одинаковым текстом ошибки, но разными способами навесить обработчик на
// кнопку «Назад».
export function JoinCodeView({
  code,
  setCode,
  error,
  loading,
  onSubmit,
  onBack,
}: {
  code: string;
  setCode: (v: string) => void;
  error: boolean;
  loading: boolean;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-12)',
          marginBottom: 16,
        }}
      >
        <span
          {...pressable(onBack)}
          aria-label="Назад"
          style={{ fontSize: 22, color: 'var(--text-sub)', cursor: 'pointer' }}
        >
          ‹
        </span>
        <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
          Ввести код
        </span>
      </div>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Код из приглашения"
        style={{
          width: '100%',
          padding: '12px 14px',
          borderRadius: 'var(--r-12)',
          background: 'rgba(var(--fg-rgb),0.06)',
          border: '1px solid rgba(var(--fg-rgb),0.1)',
          color: 'var(--text)',
          fontSize: 16,
          fontFamily: 'monospace',
          outline: 'none',
          letterSpacing: 4,
          textAlign: 'center',
          boxSizing: 'border-box',
          marginBottom: 12,
        }}
      />
      {error && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--accent-red)',
            textAlign: 'center',
            marginBottom: 10,
          }}
        >
          Код не найден или уже использован
        </div>
      )}
      <button
        onClick={onSubmit}
        disabled={!code.trim() || loading}
        style={{
          width: '100%',
          padding: '14px',
          border: 'none',
          borderRadius: 'var(--r-12)',
          background: code.trim()
            ? 'var(--accent)'
            : 'color-mix(in srgb, var(--accent) 30%, transparent)',
          color: 'var(--text)',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Присоединиться
      </button>
    </div>
  );
}
