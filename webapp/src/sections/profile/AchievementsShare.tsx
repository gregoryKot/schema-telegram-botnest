// Шаринг ВСЕХ достижений из диалога профиля: кнопка + карточка-картинка со
// счётом «получено из всех». Отрисовка и текст — shared/src/share (те же, что
// в мини-аппе, schema-miniapp/.../AchievementsSheet.tsx); видна, только когда
// есть что показать (ни одного — делиться нечем).
import { useCallback, useState } from 'react';
import type { Achievement } from '../../api';
import { SharePillButton } from '../../share/SharePillButton';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { drawAchievementsCard } from '../../../../shared/src/share/cards/achievementsCard';
import { achievementsShareText } from '../../../../shared/src/share/shareTexts';
import { botShortUrl } from '../../utils/botConfig';
import { ACHIEVEMENT_META } from './profileMeta';

export function AchievementsShare({ achievements }: { achievements: Achievement[] }) {
  const [open, setOpen] = useState(false);
  const earned = achievements.filter((a) => a.earned).length;
  const draw = useCallback(
    // Эмодзи в мете нет — карточка рисует пустой медальон (как в мини-аппе).
    (canvas: HTMLCanvasElement) => drawAchievementsCard(canvas, achievements.filter((a) => ACHIEVEMENT_META[a.id]).map((a) => ({ emoji: '', earned: a.earned }))),
    [achievements],
  );
  if (earned === 0) return null;
  return (
    <>
      <SharePillButton label="Поделиться достижениями" onClick={() => setOpen(true)} />
      {open && (
        <ShareCardSheet
          title="Мои достижения"
          draw={draw}
          shareText={achievementsShareText(earned, achievements.length, botShortUrl)}
          filename="achievements.png"
          eventKind="achievements"
          onClose={() => setOpen(false)}
          zIndex={450}
        />
      )}
    </>
  );
}
