import { useState } from 'react';
import { DiaryType } from '../../../types';
import { loadDraft, formatDraftAge } from '../../../utils/drafts';
import { cm } from './shared';

// Карточка черновика записи дневника. Вынесено из DiaryListView.tsx (правило №10).
export function DraftCard({
  type,
  color,
  onContinue,
  onDelete,
}: {
  type: DiaryType;
  color: string;
  onContinue: () => void;
  onDelete: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const draft = loadDraft<{
    trigger?: string;
    situation?: string;
    items?: string[];
  }>(type);
  if (!draft) return null;

  const preview =
    type === 'schema'
      ? draft.data?.trigger
      : type === 'mode'
        ? draft.data?.situation
        : draft.data?.items?.[0];

  return (
    <div
      style={{
        borderRadius: 16,
        padding: '14px 16px',
        marginBottom: 14,
        background: cm(color, 5),
        border: `1px dashed ${cm(color, 30)}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '3px 7px',
              borderRadius: 6,
              background: cm(color, 13),
              color,
            }}
          >
            Черновик
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>
            {formatDraftAge(draft.startedAt)}
          </span>
        </div>
      </div>
      {preview && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            marginBottom: 10,
            lineHeight: 1.4,
          }}
        >
          {preview.length > 80 ? preview.slice(0, 80) + '…' : preview}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onContinue}
          style={{
            flex: 1,
            padding: '9px 0',
            borderRadius: 10,
            border: 'none',
            background: color,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Продолжить
        </button>
        {!confirm ? (
          <button
            onClick={() => setConfirm(true)}
            style={{
              padding: '9px 14px',
              borderRadius: 10,
              border: 'none',
              background: 'rgba(var(--fg-rgb),0.06)',
              color: 'var(--text-sub)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Удалить
          </button>
        ) : (
          <button
            onClick={onDelete}
            style={{
              padding: '9px 14px',
              borderRadius: 10,
              border: 'none',
              background:
                'color-mix(in srgb, var(--accent-red) 20%, transparent)',
              color: 'var(--accent-red)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Да, удалить
          </button>
        )}
      </div>
    </div>
  );
}
