// Оверлей достижения (вынесен из ProfileSection). «Поделиться» открывает
// share-карточку-картинку (shared/src/share) вместо голого текста.
// Парный файл: schema-miniapp/src/components/AchievementDetail.tsx (вёрстка своя).
import { useCallback, useState } from 'react';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { drawAchievementCard } from '../../../shared/src/share/cards/achievementCard';
import type { AchievementMeta } from '../../../shared/src/share/cards/achievementCard';
import { achievementShareText } from '../../../shared/src/share/shareTexts';
import { botShortUrl } from '../utils/botConfig';
import { useDialogA11y } from '../../../shared/src/utils/dialogA11y';

interface Props {
  meta: AchievementMeta;
  onClose: () => void;
}

export function AchievementDetail({ meta, onClose }: Props) {
  const goBack = useHistorySheet(onClose);
  const dialogA11y = useDialogA11y();
  const [showShare, setShowShare] = useState(false);
  const draw = useCallback(
    (canvas: HTMLCanvasElement) => drawAchievementCard(canvas, meta),
    [meta],
  );

  return (
    <div
      role="presentation"
      onClick={goBack}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        animation: 'fade-in 0.18s ease',
      }}
    >
      {/* onClick — не интерактив, а stopPropagation (не дать клику дойти до
          onClick={goBack} на бэкдропе). role="dialog" (К4, useDialogA11y)
          не входит в список «интерактивных» ролей jsx-a11y — ложное
          срабатывание, клавиатура тут ничего не активирует. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        {...dialogA11y}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--sheet-bg)',
          borderRadius: 28,
          padding: '36px 28px 28px',
          width: '100%',
          maxWidth: 320,
          textAlign: 'center',
          animation: 'sheet-up 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 8,
          }}
        >
          {meta.title}
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'var(--text-sub)',
            lineHeight: 1.6,
            marginBottom: 28,
          }}
        >
          {meta.desc}
        </div>
        <button onClick={() => setShowShare(true)} className="btn-primary">
          Поделиться
        </button>
      </div>

      {showShare && (
        <div role="presentation" onClick={(e) => e.stopPropagation()}>
          <ShareCardSheet
            title="Достижение"
            draw={draw}
            shareText={achievementShareText(meta.title, botShortUrl)}
            filename="achievement.png"
            eventKind="achievement"
            onClose={() => setShowShare(false)}
            zIndex={450}
          />
        </div>
      )}
    </div>
  );
}
