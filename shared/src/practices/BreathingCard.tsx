// «Дыши со мной» — дыхание 4-4-6 (экран «Здесь и сейчас», дизайн-макет;
// волна 2 нейродизайна). Idle-состояние — спокойная карточка с пульсирующим
// кругом (CSS-анимация breathe глушится глобальным reduced-motion блоком
// index.css); активная сессия — фазы из practices/breathing с крупным отсчётом.
// При сниженной анимации круг не масштабируется — только текст фаз.
// Прохождение засчитывается через useQuickPractice, только если пройден хотя
// бы один полный цикл (BREATH_CYCLE_S) — досрочная остановка не считается.
// Под карточкой — счётчик + «Поделиться» через общий PracticeDoneFooter
// (правило «одна механика — один компонент», как у QuickPracticeFlow).
// Жил в schema-miniapp/src/components/BreathingCard.tsx; при переносе раздела
// на сайт переехал сюда целиком — после выноса логики вёрстка совпала бы
// построчно, значит и она общая (правило №3). Площадочное — инъекцией:
// api, ShareCardSheet и botShortUrl у webapp и мини-аппа свои. Три точечных
// значения при переезде сели на шкалу токенов (24→--r-20 у карточки,
// 18→--space-20 под кругом, 99→999 у кнопки-пилюли): гейт check-scale-drift
// требует этого от нового файла, а сама шкала (tokens.css) называет 18/24
// «точечными подгонками вне кластера». Сдвиг на 2-4px намеренный.
import { useEffect, useRef, useState, type ComponentType } from 'react';
import {
  breathStateAt,
  BREATH_PHASE_LABEL,
  BREATH_IN_S,
  BREATH_HOLD_S,
  BREATH_OUT_S,
  BREATH_CYCLE_S,
} from './breathing';
import { isReducedMotion } from '../utils/reducedMotion';
import { useTr } from '../utils/addressForm';
import { useQuickPractice, type QuickPracticeApi } from './useQuickPractice';
import { PracticeDoneFooter, practiceCountLabel } from './PracticeDoneFooter';
import { drawPracticeCard } from '../share/cards/practiceCard';
import { practiceShareText } from '../share/shareTexts';
import type { ShareCardSheetProps } from '../share/shareCardSheetProps';
import { buildQuickPractice } from './quickPractices';

const PHASE_SCALE = { in: 1.25, hold: 1.25, out: 1 } as const;

export interface BreathingCardProps {
  api: QuickPracticeApi & {
    trackEvent: (name: string, meta?: Record<string, unknown>) => void;
  };
  ShareCardSheet: ComponentType<ShareCardSheetProps>;
  botShortUrl: string;
}

export function BreathingCard({
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
  const reduced = isReducedMotion();
  const scale = active && !reduced ? PHASE_SCALE[st.phase] : 1;
  const phaseDur =
    st.phase === 'in'
      ? BREATH_IN_S
      : st.phase === 'hold'
        ? BREATH_HOLD_S
        : BREATH_OUT_S;
  const countLabel = practiceCountLabel(count);

  return (
    <>
      <div
        style={{
          borderRadius: 'var(--r-20)',
          background:
            'color-mix(in srgb, var(--accent-green) 12%, transparent)',
          padding: '26px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 92,
            height: 92,
            borderRadius: '50%',
            background: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: active ? 26 : 40,
            fontWeight: 800,
            color: 'var(--accent-green)',
            fontVariantNumeric: 'tabular-nums',
            animation: active ? 'none' : 'breathe-idle 5s ease-in-out infinite',
            transform: `scale(${scale})`,
            transition: `transform ${phaseDur}s ease-in-out`,
          }}
        >
          <style>{`@keyframes breathe-idle { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }`}</style>
          {active ? st.secondsLeft : null}
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: 'var(--accent-green)',
            marginTop: 'var(--space-20)',
          }}
        >
          {active
            ? BREATH_PHASE_LABEL[st.phase]
            : tr('Дыши со мной', 'Дышите со мной')}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            marginTop: 4,
            lineHeight: 1.5,
          }}
        >
          {active ? (
            <>круг {st.cycle} · вдох 4 · задержка 4 · выдох 6</>
          ) : (
            <>
              Вдох на 4 · задержка на 4 · выдох на 6.
              <br />
              Одна минута — и станет легче.
            </>
          )}
        </div>
        <button
          onClick={active ? stop : start}
          style={{
            marginTop: 16,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            background: active
              ? 'rgba(var(--fg-rgb),0.08)'
              : 'var(--accent-green)',
            color: active ? 'var(--text-sub)' : 'var(--bg)',
            fontSize: 14,
            fontWeight: 800,
            padding: '12px 28px',
            borderRadius: 999,
            minHeight: 44,
          }}
        >
          {active ? 'Достаточно' : 'Начать дыхание'}
        </button>
      </div>

      <PracticeDoneFooter count={count} onShare={() => setShowShare(true)} />

      {showShare && (
        <ShareCardSheet
          title={practice.title}
          draw={(canvas) => drawPracticeCard(canvas, practice, countLabel)}
          shareText={practiceShareText(practice.title, countLabel, botShortUrl)}
          filename="practice-breathing.png"
          eventKind="practice"
          onClose={() => setShowShare(false)}
        />
      )}
    </>
  );
}
