// Оверлей «Сводка для терапевта» (вынесено из SettingsSheet.tsx).
import { useState } from 'react';
import { BottomSheet } from '../BottomSheet';

export function ExportOverlay({
  text,
  onClose,
}: {
  text: string;
  onClose: () => void;
}) {
  const [exportCopied, setExportCopied] = useState(false);
  return (
    <BottomSheet onClose={onClose} zIndex={300}>
      <div style={{ paddingTop: 4 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 12,
          }}
        >
          Сводка для терапевта
        </div>
        <pre
          style={{
            fontSize: 11,
            color: 'var(--text-sub)',
            lineHeight: 1.6,
            background: 'rgba(var(--fg-rgb),0.04)',
            borderRadius: 12,
            padding: '12px 14px',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            marginBottom: 14,
            userSelect: 'all',
            fontFamily: 'monospace',
          }}
        >
          {text}
        </pre>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setExportCopied(true);
              setTimeout(() => setExportCopied(false), 2000);
            } catch {
              /* best-effort: ошибку намеренно игнорируем */
            }
          }}
          style={{
            width: '100%',
            padding: '13px 0',
            border: 'none',
            borderRadius: 12,
            background: exportCopied
              ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)'
              : 'rgba(var(--fg-rgb),0.08)',
            color: exportCopied ? '#06d6a0' : 'rgba(var(--fg-rgb),0.7)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {exportCopied ? '✓ Скопировано' : 'Скопировать'}
        </button>
      </div>
    </BottomSheet>
  );
}
