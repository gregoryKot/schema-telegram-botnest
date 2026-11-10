// Рамка карточки «Дыши со мной» (фабрика компонента): вся логика дыхания 4-4-6
// — таймер, фазы, засчитывание прохождения, окно шаринга — одна на все входы:
// раздел «Практики», лист из ⌘K, итог разбора и «Что поможет» паттерна (правило №3:
// до 2026-11 из палитры шло второе, пошаговое дыхание). Вёрстку (View) и подвал
// (Footer) вставляет площадка, передавая их в createBreathingCard.
// Таймер, конец «через минуту» и засчитывание прохождения — useBreathingSession.
import { useState, type ComponentType, type ReactNode } from 'react';
import { breathStateAt, type BreathState } from './breathing';
import {
  breathCardText,
  type BreathCardText,
  type BreathStage,
} from './breathingText';
import { useBreathingSession, type BreathingApi } from './useBreathingSession';
import { isReducedMotion } from '../utils/reducedMotion';
import { useTr } from '../utils/addressForm';
import type { PracticeDoneFooterProps } from './PracticeDoneFooter';
import { practiceCountLabel } from './practiceCountLabel';
import { buildQuickPractice } from './quickPractices';
import { drawPracticeCard } from '../share/cards/practiceCard';
import { practiceShareText } from '../share/shareTexts';
import type { ShareCardSheetProps } from '../share/shareCardSheetProps';

export interface BreathingCardProps {
  api: BreathingApi;
  ShareCardSheet: ComponentType<ShareCardSheetProps>;
  botShortUrl: string;
  /** Дыхание в листе: «Закрыть» в покое и на итоге. */
  onClose?: () => void;
  /** Под кнопками в покое — предупреждение площадки. */
  note?: ReactNode;
  /** Оболочка вида (лист): карточка шаринга остаётся снаружи — поверх листа. */
  frame?: (view: ReactNode) => ReactNode;
  /** Слой карточки шаринга над листом (лист 300 → карточка 320). */
  shareZIndex?: number;
}

/** Что рамка отдаёт вёрстке карточки. */
export interface BreathingViewProps {
  stage: BreathStage;
  st: BreathState;
  /** Заголовок, подпись и кнопка — одни на все вёрстки (breathingText). */
  text: BreathCardText;
  /** Сниженная анимация: сцена стоит, меняются подпись и полоса фаз. */
  reduced: boolean;
  start: () => void;
  stop: () => void;
  onClose?: () => void;
  note?: ReactNode;
  /** Счётчик прохождений и «поделиться» (Footer площадки). */
  footer: ReactNode;
}

export const createBreathingCard = (
  View: ComponentType<BreathingViewProps>,
  Footer: ComponentType<PracticeDoneFooterProps>,
) =>
  function BreathingCard({
    api,
    ShareCardSheet,
    botShortUrl,
    onClose,
    note,
    frame,
    shareZIndex,
  }: BreathingCardProps) {
    const tr = useTr();
    const { active, finished, elapsed, count, start, stop } =
      useBreathingSession(api);
    const [showShare, setShowShare] = useState(false);
    const practice = buildQuickPractice('breathing', tr);
    const stage: BreathStage = active
      ? 'active'
      : finished
        ? 'finished'
        : 'idle';
    const st = breathStateAt(elapsed);
    const countLabel = practiceCountLabel(count);

    const view = (
      <View
        stage={stage}
        st={st}
        text={breathCardText(tr, stage, st)}
        reduced={isReducedMotion()}
        start={start}
        stop={stop}
        onClose={onClose}
        note={note}
        footer={<Footer count={count} onShare={() => setShowShare(true)} />}
      />
    );
    return (
      <>
        {frame ? frame(view) : view}
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
            zIndex={shareZIndex}
          />
        )}
      </>
    );
  };
