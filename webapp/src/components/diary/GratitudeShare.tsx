// Поделиться записью благодарности — паритет с мини-аппом
// (schema-miniapp/.../GratitudeCard.tsx). Карточка рисуется shared-функцией,
// событие share_card kind=gratitude шлёт сам ShareCardSheet. Тап явный, с превью.
import { useState } from 'react';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { drawGratitudeCard } from '../../../../shared/src/share/cards/gratitudeCard';
import { gratitudeShareText } from '../../../../shared/src/share/shareTexts';
import { botShortUrl } from '../../utils/botConfig';

export function GratitudeShare({ items, dateLabel }: { items: string[]; dateLabel: string }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <>
      <button className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => setOpen(true)}>
        Поделиться благодарностью
      </button>
      {open && (
        <ShareCardSheet
          title="Поделиться благодарностью"
          draw={(canvas) => drawGratitudeCard(canvas, items, dateLabel)}
          shareText={gratitudeShareText(botShortUrl)}
          filename="gratitude.png"
          eventKind="gratitude"
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
