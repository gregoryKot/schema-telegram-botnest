// Компактная кнопка «Поделиться» (иконка), парная schema-miniapp/src/share/
// SharePill.tsx (compact-режим) — правило №3, вёрстка per-frontend. Один
// примитив на несколько кнопок шаринга (правило «одна механика — один
// компонент»): PhraseShareCard, DiaryShareButton, MonthShareButton.
import { ShareIcon } from '../../../shared/src/share/ShareIcon';

export function SharePillButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 40,
        width: 40,
        borderRadius: 'var(--r-12)',
        border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)',
        background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
        color: 'var(--accent)',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <ShareIcon />
    </button>
  );
}
