import { useState } from 'react';
import { pressable } from '../../../utils/a11y';
import { GratitudeDiaryEntry } from '../../../types';
import { SharePill } from '../../../share/SharePill';
import { ShareCardSheet } from '../../../share/ShareCardSheet';
import { drawGratitudeCard } from '../../../../../shared/src/share/cards/gratitudeCard';
import { gratitudeShareText } from '../../../../../shared/src/share/shareTexts';
import { botShortUrl } from '../../../utils/botConfig';
import { DeleteBtn } from './shared';

// Карточка записи дневника благодарности. Вынесено из DiaryListView.tsx (правило №10).
export function GratitudeCard({
  entry,
  color,
  onDelete,
}: {
  entry: GratitudeDiaryEntry;
  color: string;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const dateLabel = new Date(entry.date + 'T12:00:00').toLocaleDateString(
    'ru',
    { day: 'numeric', month: 'long' },
  );

  return (
    <div className="d-entry">
      <div
        {...pressable(() => setOpen((v) => !v))}
        style={{ cursor: 'pointer' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--faint)' }}>
            {dateLabel}
          </span>
          <span style={{ fontSize: 13, color: 'var(--chevron)' }}>
            {open ? '▲' : '▼'}
          </span>
        </div>
        {!open && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {entry.items.slice(0, 2).map((item, i) => (
              <span key={i} style={{ fontSize: 13, color: 'var(--text-sub)' }}>
                {i > 0 && '· '}
                {item.length > 40 ? item.slice(0, 40) + '…' : item}
              </span>
            ))}
            {entry.items.length > 2 && (
              <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                +{entry.items.length - 2}
              </span>
            )}
          </div>
        )}
        {open && (
          <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>
            {entry.items.length} записи
          </div>
        )}
      </div>
      {open && (
        <div style={{ marginTop: 10 }}>
          {entry.items.map((item, i) => (
            <div
              key={i}
              style={{
                fontSize: 14,
                color: 'var(--ink-2)',
                marginBottom: 8,
                paddingLeft: 12,
                borderLeft: '1px solid var(--line)',
                lineHeight: 1.5,
              }}
            >
              {item}
            </div>
          ))}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-8)',
            }}
          >
            <DeleteBtn color={color} onClick={onDelete} />
            {/* Шэр СВОЕЙ записи — только по явному тапу, с превью карточки */}
            <SharePill compact onClick={() => setShowShare(true)} />
          </div>
        </div>
      )}

      {showShare && (
        <ShareCardSheet
          title="Поделиться благодарностью"
          draw={(canvas) => drawGratitudeCard(canvas, entry.items, dateLabel)}
          shareText={gratitudeShareText(botShortUrl)}
          filename="gratitude.png"
          eventKind="gratitude"
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
