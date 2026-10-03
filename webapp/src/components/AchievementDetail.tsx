// Оверлей достижения (вынесен из ProfileSection). «Поделиться» открывает
// share-карточку-картинку (shared/src/share) вместо голого текста.
// Парный файл: schema-miniapp/src/components/AchievementDetail.tsx (вёрстка своя).
// Окно — общий Dialog (единый editorial-вид центрированных диалогов сайта).
import { useCallback, useState } from 'react';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { drawAchievementCard } from '../../../shared/src/share/cards/achievementCard';
import type { AchievementMeta } from '../../../shared/src/share/cards/achievementCard';
import { achievementShareText } from '../../../shared/src/share/shareTexts';
import { botShortUrl } from '../utils/botConfig';
import { Dialog } from './Dialog';

interface Props {
  meta: AchievementMeta;
  onClose: () => void;
}

export function AchievementDetail({ meta, onClose }: Props) {
  const goBack = useHistorySheet(onClose);
  const [showShare, setShowShare] = useState(false);
  const draw = useCallback(
    (canvas: HTMLCanvasElement) => drawAchievementCard(canvas, meta),
    [meta],
  );

  return (
    <>
      <Dialog label={meta.title} onClose={goBack} zIndex={400} maxWidth={360} center>
        <h2 className="dialog-title">{meta.title}</h2>
        <p className="dialog-text">{meta.desc}</p>
        <button onClick={() => setShowShare(true)} className="btn-primary">
          Поделиться
        </button>
      </Dialog>

      {showShare && (
        <ShareCardSheet
          title="Достижение"
          draw={draw}
          shareText={achievementShareText(meta.title, botShortUrl)}
          filename="achievement.png"
          eventKind="achievement"
          onClose={() => setShowShare(false)}
          zIndex={450}
        />
      )}
    </>
  );
}
