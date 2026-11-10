// Вёрстка «Дыши со мной» (рамка createBreathingCard): лист бирюзы, «воздух» (QUICK_LOOK.breathing) с живой
// сценой SceneBreath — дуги над полоской расходятся на вдохе, стоят на задержке, опускаются на
// выдохе; на итоге ложатся, у полоски вырастает лист. Сниженная анимация — сцена стоит, меняются
// подпись, отсчёт и полоса фаз. Одна вёрстка для раздела «Практики» и листа (⌘K, итог разбора,
// паттерн): в листе есть «Закрыть», на итоге она главнее «Ещё минуту». Высота не зависит от этапа
// (ревью g4 r2: квадраты под героем и кнопки листа дёргались на старте и в итоге): место подписи и
// полосы фаз — по самой высокой (.qb-slot), ряд кнопок листа — по двум кнопкам (.qb--sheet),
// предупреждение площадки под листом стоит на всех этапах.
import type { CSSProperties } from 'react';
import { glue } from '../../../../shared/src/utils/typo';
import type { BreathingViewProps } from '../../../../shared/src/practices/createBreathingCard';
import { SceneBreath } from '../art/AppScenes';
import { BreathActions } from './BreathActions';
import { BreathPhases } from './BreathPhases';
import { breathScenePhase } from './breathScene';
import { QUICK_LOOK } from './quickLook';
import '../../styles/breathing.css';
import '../../styles/quick-practice.css';

export function BreathingPaperView({ stage, st, text, reduced, start, stop, onClose, note, footer, titleAs }: BreathingViewProps) {
  const Title = titleAs ?? 'h2'; // лист — h2; на странице — уровнем ниже заголовка блока (HereAndNowBlock)
  const { hue } = QUICK_LOOK.breathing;
  const active = stage === 'active';
  const scene = breathScenePhase(stage, st.phase, reduced);
  return (
    <>
      <section className={onClose ? 'pp-paper qb qb--sheet' : 'pp-paper qb'} style={{ '--h': hue } as CSSProperties} data-stage={stage} aria-label="Дыхание 4-4-6">
        <div className="qb-in">
          <div className="qb-scene" aria-hidden="true">
            <SceneBreath phase={scene.phase} hue={hue} seconds={scene.seconds} />
            {active && <span className="qb-count">{st.secondsLeft}</span>}
          </div>
          <div className="qb-body">
            <span className="ds-label qb-label">Дыхание 4-4-6</span>
            <Title className="qb-title" aria-live="polite">{text.title}</Title>
            <div className="qb-slot">
              {active && text.cycle ? (
                <BreathPhases cycle={text.cycle} st={st} />
              ) : (
                <p className="qb-text">
                  {text.lines.map((line, i) => (
                    <span key={i}>{i > 0 && <br />}{glue(line)}</span>
                  ))}
                </p>
              )}
            </div>
            <div className="qb-actions">
              <BreathActions stage={stage} text={text} start={start} stop={stop} onClose={onClose} />
            </div>
            <div className="qb-foot">{footer}</div>
          </div>
        </div>
      </section>
      {note}
    </>
  );
}
