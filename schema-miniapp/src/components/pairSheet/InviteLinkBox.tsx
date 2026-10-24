import { CopyFailedHint } from '../../../../shared/src/components/CopyFailedHint';

// Общая карточка «ссылка + кнопка копирования» механики «пара» (правило №11
// CLAUDE.md) — раньше один и тот же блок был написан дважды почти дословно
// (PairSheet.tsx — дважды внутри себя, PartnerSection.tsx — ещё раз) с двумя
// разными способами показать отказ копирования.
export function InviteLinkBox({
  label,
  url,
  copied,
  failed,
  onCopy,
}: {
  label: string;
  url: string;
  copied: boolean;
  failed: boolean;
  onCopy: () => void;
}) {
  return (
    <div
      style={{
        background: 'rgba(var(--fg-rgb),0.04)',
        borderRadius: 'var(--r-12)',
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-sub)',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'rgba(var(--fg-rgb),0.7)',
          wordBreak: 'break-all',
          lineHeight: 1.5,
          marginBottom: 10,
          userSelect: 'all',
        }}
      >
        {url}
      </div>
      <button
        onClick={onCopy}
        style={{
          width: '100%',
          padding: '10px',
          border: 'none',
          borderRadius: 'var(--r-10)',
          background: copied
            ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)'
            : 'color-mix(in srgb, var(--accent) 20%, transparent)',
          color: copied ? '#06d6a0' : 'var(--accent)',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {copied ? '✓ Скопировано' : 'Скопировать ссылку'}
      </button>
      <CopyFailedHint show={failed} />
    </div>
  );
}
