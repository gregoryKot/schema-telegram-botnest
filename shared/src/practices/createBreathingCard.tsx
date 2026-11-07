// Рамка карточки «Дыши со мной» (фабрика компонента): вся логика дыхания 4-4-6
// — таймер, фазы, засчитывание прохождения, окно шаринга — одна на обе вёрстки.
// Вёрстку карточки (View) и подвала (Footer) вставляет площадка — мини-апп
// (BreathingCard) или сайт (BreathingSiteCard), передавая их в
// createBreathingCard; так чужая вёрстка не попадает в бандл.
// Таймер, конец «через минуту» и засчитывание прохождения — useBreathingSession.
import { useState, type ComponentType } from 'react';
import {
  breathStateAt,
  BREATH_IN_S,
  BREATH_HOLD_S,
  BREATH_OUT_S,
} from './breathing';
import { breathCardText, type BreathCardText } from './breathingText';
import { useBreathingSession, type BreathingApi } from './useBreathingSession';
import { isReducedMotion } from '../utils/reducedMotion';
import { useTr } from '../utils/addressForm';
import type { PracticeDoneFooterProps } from './PracticeDoneFooter';
import { practiceCountLabel } from './practiceCountLabel';
import { buildQuickPractice } from './quickPractices';
import { drawPracticeCard } from '../share/cards/practiceCard';
import { practiceShareText } from '../share/shareTexts';
import type { ShareCardSheetProps } from '../share/shareCardSheetProps';

const PHASE_SCALE = { in: 1.25, hold: 1.25, out: 1 } as const;

/** Пульс круга в покое; глушится глобальным reduced-motion блоком index.css. */
export const BREATHE_IDLE_KEYFRAMES = `@keyframes breathe-idle { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }`;

export interface BreathingCardProps {
  api: BreathingApi;
  ShareCardSheet: ComponentType<ShareCardSheetProps>;
  botShortUrl: string;
}

/** Что рамка отдаёт вёрстке карточки. */
export interface BreathingViewProps {
  active: boolean;
  /** Минута пройдена — итог и «Ещё минуту». */
  finished: boolean;
  st: ReturnType<typeof breathStateAt>;
  /** Заголовок, подпись и кнопка — одни на обе вёрстки (breathingText). */
  text: BreathCardText;
  /** Анимация круга (одна на обе вёрстки): пульс в покое, scale по фазам. */
  pulse: { animation: string; transform: string; transition: string };
  start: () => void;
  stop: () => void;
}

export const createBreathingCard = (
  View: ComponentType<BreathingViewProps>,
  Footer: ComponentType<PracticeDoneFooterProps>,
) =>
  function BreathingCard({
    api,
    ShareCardSheet,
    botShortUrl,
  }: BreathingCardProps) {
    const tr = useTr();
    const { active, finished, elapsed, count, start, stop } =
      useBreathingSession(api);
    const [showShare, setShowShare] = useState(false);
    const practice = buildQuickPractice('breathing', tr);

    const st = breathStateAt(elapsed);
    const scale = active && !isReducedMotion() ? PHASE_SCALE[st.phase] : 1;
    const phaseDur =
      st.phase === 'in'
        ? BREATH_IN_S
        : st.phase === 'hold'
          ? BREATH_HOLD_S
          : BREATH_OUT_S;

    const pulse = {
      animation:
        active || finished ? 'none' : 'breathe-idle 5s ease-in-out infinite',
      transform: `scale(${scale})`,
      transition: `transform ${phaseDur}s ease-in-out`,
    };
    const countLabel = practiceCountLabel(count);

    return (
      <>
        <View
          active={active}
          finished={finished}
          text={breathCardText(
            tr,
            active ? 'active' : finished ? 'finished' : 'idle',
            st,
          )}
          st={st}
          pulse={pulse}
          start={start}
          stop={stop}
        />
        <Footer count={count} onShare={() => setShowShare(true)} />

        {showShare && (
          <ShareCardSheet
            title={practice.title}
            draw={(canvas) => drawPracticeCard(canvas, practice, countLabel)}
            shareText={practiceShareText(
              practice.title,
              countLabel,
              botShortUrl,
            )}
            filename="practice-breathing.png"
            eventKind="practice"
            onClose={() => setShowShare(false)}
          />
        )}
      </>
    );
  };
