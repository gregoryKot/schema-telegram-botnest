// Оверлей достижения: лист бумаги оттенка значка (ACHIEVEMENT_LOOK), знак крупно с тенью-вырезкой,
// заголовок Literata, одна залитая «Поделиться» — share-карточка-картинка (shared/src/share).
// Окно — общий Dialog; бумага — обёртка cpf-paper-dlg (client-profile.css). Без вида — лист без знака.
import { useCallback, useState, type CSSProperties } from 'react';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { drawAchievementCard, type AchievementMeta } from '../../../shared/src/share/cards/achievementCard';
import type { Look } from '../../../shared/src/theme/entityLook';
import { achievementShareText } from '../../../shared/src/share/shareTexts';
import { botShortUrl } from '../utils/botConfig';
import { Dialog } from './Dialog';
import { SignHero } from './paper/SignHero';

interface Props { id: string; meta: AchievementMeta; look?: Look | null; onClose: () => void }

// id — знак и оттенок значка на карточке шаринга (achievementCardLook)
export function AchievementDetail({ id, meta, look, onClose }: Props) {
  const goBack = useHistorySheet(onClose);
  const [showShare, setShowShare] = useState(false);
  const draw = useCallback((canvas: HTMLCanvasElement) => drawAchievementCard(canvas, { ...meta, id }), [meta, id]);
  return (
    <>
      <Dialog label={meta.title} onClose={goBack} closeOnEscape zIndex={400} maxWidth={380} center>
        <div className="pp-paper cpf-paper-dlg cpf-ach-detail" style={look ? ({ '--h': look.hue } as CSSProperties) : undefined}>
          {look && <SignHero sign={look.sign} className="cpf-ach-detail-art" />}
          <h2 className="dialog-title cpf-ach-detail-title">{meta.title}</h2>
          <p className="dialog-text">{meta.desc}</p>
          <button onClick={() => setShowShare(true)} className="ds-btn u-w100">Поделиться</button>
        </div>
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
