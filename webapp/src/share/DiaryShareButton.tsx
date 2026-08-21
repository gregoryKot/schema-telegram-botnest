// Кнопка шаринга дневника (архив, DiarySection.tsx): сводная карточка
// «N записей · веду с даты» — без приватного текста записей. Паритет с
// schema-miniapp/src/share/DiaryShareButton.tsx (правило №16), логика
// рисования — из shared (правило №3), вёрстка своя.
import { useCallback, useState } from 'react';
import { SharePillButton } from './SharePillButton';
import { ShareCardSheet } from './ShareCardSheet';
import { drawDiaryCard, earliestDateLabel } from '../../../shared/src/share/cards/diaryCard';
import { diaryShareText } from '../../../shared/src/share/shareTexts';
import { botShortUrl } from '../utils/botConfig';

interface Props {
  emoji: string;
  title: string;
  /** CSS-переменная или hex */
  color: string;
  entries: Array<{ createdAt: string }>;
}

export function DiaryShareButton({ emoji, title, color, entries }: Props) {
  const [open, setOpen] = useState(false);
  const count = entries.length;
  const since = earliestDateLabel(entries);

  const draw = useCallback(
    (canvas: HTMLCanvasElement) => {
      drawDiaryCard(canvas, { emoji, title, color, count, since });
    },
    [emoji, title, color, count, since],
  );

  if (count === 0) return null;

  return (
    <>
      <SharePillButton onClick={() => setOpen(true)} label="Поделиться дневником" />
      {open && (
        <ShareCardSheet
          title="Поделиться дневником"
          draw={draw}
          shareText={diaryShareText(title, emoji, count, since, botShortUrl)}
          filename="diary.png"
          eventKind="diary"
          onClose={() => setOpen(false)}
          therapyNote
        />
      )}
    </>
  );
}
