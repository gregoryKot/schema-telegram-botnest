// Кнопка шаринга дневника (архив/хедер списка записей) — единственная копия
// (правило №3). Была продублирована 1-в-1 при переносе шаринга на сайт:
// сама кнопка и ShareCardSheet (вёрстка своя per-frontend) приходят
// инъекцией, как в shared/share/MonthShareButton.tsx.
import {
  useCallback,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { drawDiaryCard, earliestDateLabel } from './cards/diaryCard';
import { diaryShareText } from './shareTexts';
import type { ShareCardSheetProps } from './shareCardSheetProps';

export interface DiaryShareButtonProps {
  emoji: string;
  title: string;
  /** CSS-переменная или hex */
  color: string;
  entries: Array<{ createdAt: string }>;
  botShortUrl: string;
  ShareCardSheet: ComponentType<ShareCardSheetProps>;
  renderButton: (onClick: () => void) => ReactNode;
}

export function DiaryShareButton({
  emoji,
  title,
  color,
  entries,
  botShortUrl,
  ShareCardSheet,
  renderButton,
}: DiaryShareButtonProps) {
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
      {renderButton(() => setOpen(true))}
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
