// Рамка карточки «Дыши со мной» (фабрика компонента): вся логика дыхания 4-4-6
// — таймер, фазы, засчитывание прохождения, окно шаринга — одна на обе вёрстки.
// Вёрстку карточки (View) и подвала (Footer) вставляет площадка — мини-апп
// (BreathingCard) или сайт (BreathingSiteCard), передавая их в
// createBreathingCard; так чужая вёрстка не попадает в бандл.
// Прохождение засчитывается через useQuickPractice, только если пройден хотя
// бы один полный цикл (BREATH_CYCLE_S) — досрочная остановка не считается.
import { useEffect, useRef, useState, type ComponentType } from 'react';
import {
  breathStateAt,
  BREATH_IN_S,
  BREATH_HOLD_S,
  BREATH_OUT_S,
  BREATH_CYCLE_S,
} from './breathing';
import { isReducedMotion } from '../utils/reducedMotion';
import { useTr } from '../utils/addressForm';
import { useQuickPractice, type QuickPracticeApi } from './useQuickPractice';
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
  api: QuickPracticeApi & {
    trackEvent: (name: string, meta?: Record<string, unknown>) => void;
  };
  ShareCardSheet: ComponentType<ShareCardSheetProps>;
  botShortUrl: string;
}

/** Что рамка отдаёт вёрстке карточки. */
export interface BreathingViewProps {
  tr: (ty: string, vy: string) => string;
  active: boolean;
  st: ReturnType<typeof breathStateAt>;
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
    const [active, setActive] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [showShare, setShowShare] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const { count, complete } = useQuickPractice('breathing', api);
    const practice = buildQuickPractice('breathing', tr);

    useEffect(() => {
      if (!active) return;
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }, [active]);

    function start() {
      setElapsed(0);
      setActive(true);
      api.trackEvent('breath_start');
    }

    function stop() {
      setActive(false);
      // Засчитываем только полный круг — досрочный обрыв не практика.
      if (elapsed >= BREATH_CYCLE_S) complete();
      setElapsed(0);
    }

    const st = breathStateAt(elapsed);
    const scale = active && !isReducedMotion() ? PHASE_SCALE[st.phase] : 1;
    const phaseDur =
      st.phase === 'in'
        ? BREATH_IN_S
        : st.phase === 'hold'
          ? BREATH_HOLD_S
          : BREATH_OUT_S;

    const pulse = {
      animation: active ? 'none' : 'breathe-idle 5s ease-in-out infinite',
      transform: `scale(${scale})`,
      transition: `transform ${phaseDur}s ease-in-out`,
    };
    const countLabel = practiceCountLabel(count);

    return (
      <>
        <View
          tr={tr}
          active={active}
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
