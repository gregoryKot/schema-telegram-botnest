import { buildSelfMapIntro } from '../../../../shared/src/onboarding/onboardingExplainers';
import { useMemo } from 'react';
import { haptic } from '../../haptic';
import { ExScreen } from '../exercises/ExScreen';
import { SelfMapLane } from './SelfMapLane';
import { buildStage } from './selfMapStage';
import { SceneStage } from '../art/SceneStage';
import { getModeById } from '../../schemaTherapyData';
import { useTr } from '../../utils/addressForm';
import { buildMapLanes, type MapInput, type MapLaneId } from '../../../../shared/src/map/mapVm';
import { caseNextStep, buildWhereIAm, type NextStepInput, type NextStepId } from '../../../../shared/src/case/caseNextStep';
import { glue } from '../../../../shared/src/utils/typo';
import '../../styles/case-quick.css';
import '../../styles/self-map.css';
const groupOf = (modeId: string) => getModeById(modeId)?.groupId;

/**
 * «Карта себя» — накопитель разборов, единственный экран, отвечающий на
 * вопрос «где я в этой системе и что дальше». Карта не рисуется руками —
 * складывается из разборов. Герой — сцена-театр SceneStage на листе режимов
 * (небо): круги частей из тех же полос, что строки ниже; на компьютере —
 * разворот, сцена слева, полосы справа. Надпись над заголовком не дублирует его.
 *
 * Внизу ровно одна кнопка «что дальше» (caseNextStep) — не список опций
 * (правило онбординга «одно очевидное действие на экран»).
 */
export function SelfMapScreen({ map, next, onBack, onPickMode, onNextStep }: {
  map: MapInput;
  next: NextStepInput;
  onBack: () => void;
  onPickMode: (modeId: string) => void;
  onNextStep: (id: NextStepId) => void;
}) {
  const tr = useTr();
  const lanes = useMemo(() => buildMapLanes(map), [map]);
  const stage = useMemo(() => buildStage(lanes, groupOf), [lanes]);
  const step = useMemo(() => caseNextStep(next, tr), [next, tr]);
  const whereIAm = useMemo(() => buildWhereIAm(next, tr), [next, tr]);

  const emptyHints: Record<MapLaneId, string> = {
    healthy: 'Появится, когда в разборе прозвучат свои слова поддержки.',
    stage: 'Первый разбор поставит первую метку.',
    backstage:
      'Откроется из случая, где за тем, кто вышел на сцену, окажется кто-то ещё.',
    origins: '',
  };

  return (
    <ExScreen
      onBack={onBack} backLabel="Закрыть" spread
      look="modes" heroArt={<SceneStage model={stage} className="cq-scene" />}
      eyebrow={null} title="Карта себя" lede={buildSelfMapIntro(tr)}
    >
      {lanes.map((lane) => (
        <SelfMapLane key={lane.id} lane={lane} emptyHint={emptyHints[lane.id]} onPickMode={onPickMode} />
      ))}

      <p className="sm-note">{tr('Это части, а не ты целиком.', 'Это части, а не вы целиком.')}</p>

      <div className="pp-paper sm-where">
        <div className="ds-label">Где я сейчас</div>
        <p className="sm-where-text">{whereIAm}</p>
      </div>

      <div className="sm-next">
        <div className="ds-label">Что дальше</div>
        <button type="button" className="ds-btn sm-next-btn" onClick={() => { haptic.tap(); onNextStep(step.id); }}>
          {glue(step.time ? `${step.label} · ${step.time}` : step.label)}
        </button>
        {step.hint && <p className="sm-hint">{step.hint}</p>}
      </div>
    </ExScreen>
  );
}
