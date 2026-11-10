import type { CSSProperties, ReactNode } from 'react';
import { ExBar } from '../exercises/ExBar';
import { EntitySheet } from '../paper/EntitySheet';
import { SpreadLayout } from '../paper/SpreadLayout';
import { CRISIS_HUE } from '../../../../shared/src/components/crisisCardStyle';

/** Бумага «Мне плохо» — бережная роза (CRISIS_HUE = ENTITY_LOOK.sos, сверка — entityLook.test.ts): её берут
 *  лист-герой, плашки номеров и поля. Литерал из crisisCardStyle, а не рантайм-импорт entityLook (чанки). */
const SOS_PAPER = { '--h': CRISIS_HUE } as CSSProperties;

/** Каркас экрана «Мне плохо»: полноэкранный лист, бар упражнения (ExBar), колонка контента.
 *  side — лист-герой: на ≥1024 разворотом слева (SpreadLayout), уже — над колонкой.
 *  aside — тихое действие справа в баре («История» на шаге 1). */
export function FlashcardFrame({ onBack, label, children, side, aside }: {
  onBack: () => void;
  label: string;
  children: ReactNode;
  side?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="u-sheet-grid sk-fc" style={SOS_PAPER}>
      <div className="sk-fc-bar">
        <ExBar onBack={onBack} label={label} />
        {aside && <div className="sk-fc-aside">{aside}</div>}
      </div>
      <div className="sk-fc-body">
        {side
          ? <SpreadLayout side={side} className="sk-fc-spread">{children}</SpreadLayout>
          : <div className="sk-fc-col">{children}</div>}
      </div>
    </div>
  );
}

/** Шапка шага — лист «Мне плохо»: «Шаг N из 4», вопрос, полоса прогресса; со второго шага — компактнее.
 *  Огромной цифры шага больше нет: номер говорит надпись, ход — полоса. */
export function FlashcardStepHead({ n, total, title }: { n: number; total: number; title: string }) {
  return (
    <EntitySheet look="sos" className="sk-fc-step" titleAs="h1" compact={n > 1}
      label={`Шаг ${n} из ${total}`} title={title} meta={<FlashcardProgress total={total} index={n - 1} />} />
  );
}

/** Полоса прогресса по шагам: пройденные и текущий — терракота, впереди — тон глубже бумаги. */
export function FlashcardProgress({ total, index }: { total: number; index: number }) {
  return (
    <div className="sk-fc-progress" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < index ? 'is-past' : i === index ? 'is-now' : ''} />
      ))}
    </div>
  );
}
