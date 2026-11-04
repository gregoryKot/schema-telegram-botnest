import { useState } from 'react';
import { useTr } from '../../../utils/addressForm';
import {
  deleteFailedText,
  useDeleteAction,
} from '../../../../../shared/src/diary/diaryDelete';
import { cm } from './shared';

// Пока удаление идёт, кнопки выключены; сбой — строка под ними, запись на
// месте (QA 2026-11, З2; механика — shared/src/diary/diaryDelete.ts).
export function DeleteBtn({
  color,
  onClick,
}: {
  color: string;
  onClick: () => void | Promise<void>;
}) {
  const tr = useTr();
  const [confirm, setConfirm] = useState(false);
  const { busy, failed, run } = useDeleteAction(onClick);
  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        style={{
          marginTop: 8,
          background: cm(color, 13),
          border: 'none',
          borderRadius: 'var(--r-8)',
          padding: '6px 12px',
          color,
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        Удалить
      </button>
    );
  }
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--space-8)',
        marginTop: 8,
      }}
    >
      <button
        disabled={busy}
        onClick={() => {
          void run();
        }}
        style={{
          flex: 1,
          padding: '8px 0',
          borderRadius: 'var(--r-8)',
          border: 'none',
          background: 'color-mix(in srgb, var(--accent-red) 15%, transparent)',
          color: 'var(--accent-red)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Удалить навсегда
      </button>
      <button
        disabled={busy}
        onClick={() => setConfirm(false)}
        style={{
          padding: '8px 14px',
          borderRadius: 'var(--r-8)',
          border: 'none',
          background: 'rgba(var(--fg-rgb),0.06)',
          color: 'var(--text-sub)',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        Отмена
      </button>
      {failed && (
        <p
          role="alert"
          style={{
            flexBasis: '100%',
            margin: 0,
            fontSize: 12,
            color: 'var(--accent-red)',
          }}
        >
          {deleteFailedText(tr)}
        </p>
      )}
    </div>
  );
}
