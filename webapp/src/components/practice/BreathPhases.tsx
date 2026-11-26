// Полоса фаз дыхания 4-4-6 под заголовком фазы: «круг 1 из 4» и три отрезка по длине фаз
// (4 : 4 : 6). Текущая фаза заполняется ровно за свою длину (CSS-анимация, ключ — круг и фаза:
// без счёта секунд в коде), пройденные залиты, впереди — пустые. Подписи — те же слова, что
// строка подсказки (breathingText); текущая выделена весом и тоном, а не только цветом.
import type { CSSProperties } from 'react';
import { BREATH_PHASES } from '../../../../shared/src/practices/breathPhases';
import type { BreathState } from '../../../../shared/src/practices/breathing';
import { phaseMarks } from './breathScene';

export function BreathPhases({ cycle, st }: { cycle: string; st: BreathState }) {
  const marks = phaseMarks(st.phase);
  return (
    <div className="qb-phases">
      <span className="qb-cycle">{cycle}</span>
      <ol className="qb-track">
        {BREATH_PHASES.map((p, i) => (
          <li
            key={p.id}
            className={`qb-seg is-${marks[i]}`}
            style={{ flexGrow: p.seconds, '--qb-s': `${p.seconds}s` } as CSSProperties}
            aria-current={marks[i] === 'now' ? 'step' : undefined}
          >
            <span className="qb-bar" aria-hidden="true">
              <span key={`${st.cycle}-${p.id}`} className="qb-fill" />
            </span>
            <span className="qb-seg-label">{p.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
